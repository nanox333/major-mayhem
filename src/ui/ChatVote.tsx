import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ChatMsg, TwitchChat, VoteOption, matchVote, tally, validChannel, winner } from '../game/twitch';
import { track } from '../analytics';
import { Modal } from './Modal';

// Twitch chat votes. The provider owns the chat connection and the one vote running at a time; each decision screen
// calls useChatVote with its options, and the vote bar shows the count down and the tally.

type Status = 'off' | 'connecting' | 'live' | 'error';
interface Settings { channel: string; seconds: number }
interface Vote { key: string; options: VoteOption[]; votes: Map<string, string>; endsAt: number; note?: string }
interface Api {
  status: Status;
  settings: Settings;
  vote: Vote | null;
  now: number;
  connect: (s: Settings) => void;
  disconnect: () => void;
  start: (key: string, options: VoteOption[], decide: (id: string) => void) => void;
  stop: (key: string) => void;
}

const SETTINGS_KEY = 'mm-twitch';
const loadSettings = (): Settings => {
  try { const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null'); if (s?.channel !== undefined) return { channel: String(s.channel), seconds: Number(s.seconds) || 20 }; } catch { /* no settings */ }
  return { channel: '', seconds: 20 };
};

const Ctx = createContext<Api | null>(null);

export function ChatVoteProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('off');
  const [settings, setSettings] = useState(loadSettings);
  const [vote, setVote] = useState<Vote | null>(null);
  const [now, setNow] = useState(Date.now());
  const chat = useRef<TwitchChat | null>(null);
  const decideRef = useRef<((id: string) => void) | null>(null);

  // Functional update: several messages can arrive in one socket frame, before React re-renders.
  const onMsg = useCallback((m: ChatMsg) => setVote((v) => {
    if (!v || v.note || Date.now() > v.endsAt) return v;
    const id = matchVote(m.text, v.options);
    if (!id || v.votes.get(m.user) === id) return v;
    const votes = new Map(v.votes); votes.set(m.user, id);
    return { ...v, votes };
  }), []);

  const disconnect = useCallback(() => { chat.current?.close(); chat.current = null; setStatus('off'); setVote(null); }, []);
  const connect = useCallback((s: Settings) => {
    chat.current?.close();
    setSettings(s);
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* storage unavailable */ }
    if (!validChannel(s.channel)) return setStatus('error');
    chat.current = new TwitchChat(s.channel, onMsg, setStatus);
    track('twitch_connect', { seconds: s.seconds });
  }, [onMsg]);
  useEffect(() => () => chat.current?.close(), []);

  const start = useCallback((key: string, options: VoteOption[], decide: (id: string) => void) => {
    decideRef.current = decide;
    setVote((v) => (v?.key === key ? v : { key, options, votes: new Map(), endsAt: Date.now() + settings.seconds * 1000 }));
  }, [settings.seconds]);
  const stop = useCallback((key: string) => setVote((v) => (v?.key === key ? null : v)), []);

  // Count down; when time's up, the winning option is played (or the streamer picks if nobody voted).
  useEffect(() => {
    if (!vote || vote.note) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [vote?.key, vote?.note]);
  useEffect(() => {
    if (!vote || vote.note || now < vote.endsAt) return;
    const id = winner(vote.votes, vote.options);
    if (!id) { setVote({ ...vote, note: 'No votes: streamer picks' }); return; }
    track('twitch_vote', { voters: vote.votes.size, options: vote.options.length });
    setVote(null);
    decideRef.current?.(id);
  }, [now, vote]);

  return <Ctx.Provider value={{ status, settings, vote, now, connect, disconnect, start, stop }}>{children}</Ctx.Provider>;
}

/**
 * Runs a chat vote for as long as this decision is on screen (and chat is connected). `key` identifies the decision:
 * a new key starts a new vote. `decide` is called with the winning option's id.
 */
export function useChatVote(key: string | null, options: VoteOption[], decide: (id: string) => void) {
  const api = useContext(Ctx);
  const live = api?.status === 'live';
  const opts = useRef(options); opts.current = options;
  const dec = useRef(decide); dec.current = decide;
  useEffect(() => {
    if (!api || !live || !key || !opts.current.length) return;
    api.start(key, opts.current, (id) => dec.current(id));
    return () => api.stop(key);
  }, [key, live]);
}

/** The running vote: options with their tallies and the time left. */
export function ChatVoteBar() {
  const api = useContext(Ctx);
  const v = api?.vote;
  if (!api || !v) return null;
  const counts = tally(v.votes, v.options);
  const left = Math.max(0, Math.ceil((v.endsAt - api.now) / 1000));
  const total = Math.max(1, counts.reduce((a, b) => a + b, 0));
  return (
    <div className="chatvote anim-in" role="status" aria-live="polite">
      <div className="chatvote__head"><b>Chat vote</b><span>{v.note ?? `${left}s · type the number in chat`}</span></div>
      <ol className="chatvote__opts">
        {v.options.map((o, i) => (
          <li key={o.id}><i style={{ width: `${(counts[i] / total) * 100}%` }} /><span>{i + 1}</span><b>{o.label}</b><em>{counts[i]}</em></li>
        ))}
      </ol>
    </div>
  );
}

/** Header button: shows the chat connection state and opens the settings. */
export function TwitchButton({ onClick }: { onClick: () => void }) {
  const api = useContext(Ctx);
  return (
    <button className={`hud-btn twitch-btn is-${api?.status ?? 'off'}`} onClick={onClick} aria-label="Twitch chat votes" title="Twitch chat votes">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" aria-hidden="true"><path d="M4 3h16v11l-4 4h-4l-3 3v-3H4z" /><path d="M11 7v4M15 7v4" /></svg>
    </button>
  );
}

export function TwitchPanel({ onClose }: { onClose: () => void }) {
  const api = useContext(Ctx)!;
  const [channel, setChannel] = useState(api.settings.channel);
  const [seconds, setSeconds] = useState(api.settings.seconds);
  const statusText = { off: 'Not connected', connecting: 'Connecting…', live: `Reading #${api.settings.channel}`, error: validChannel(channel) ? 'Couldn\'t connect. Check the channel name.' : 'Channel names are 3–25 letters, numbers or underscores.' }[api.status];
  return (
    <Modal label="Twitch chat votes" onClose={onClose} small>
        <h3>Twitch chat votes</h3>
        <p>Let your chat pick: the teams in each case, the player, the coach, map bans and picks, the side after a knife round and the buy after a lost pistol. Viewers type the option's number (or its name). When time's up the most votes wins; you can always click yourself instead.</p>
        <p className="muted small">The game only reads chat, anonymously: no login, and nothing is posted to your channel.</p>
        <form className="twitch-form" onSubmit={(e) => { e.preventDefault(); api.connect({ channel: channel.trim().replace(/^#/, ''), seconds }); }}>
          <label>Channel<input value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="yourchannel" autoComplete="off" spellCheck={false} /></label>
          <label>Vote time
            <select value={seconds} onChange={(e) => setSeconds(Number(e.target.value))}>{[10, 15, 20, 30, 45].map((s) => <option key={s} value={s}>{s} seconds</option>)}</select>
          </label>
          <div className="twitch-form__btns">
            <button className="cta cta--orange" type="submit">{api.status === 'live' ? 'Reconnect' : 'Connect'}</button>
            {api.status !== 'off' && <button className="ghost-btn" type="button" onClick={api.disconnect}>Disconnect</button>}
          </div>
        </form>
        <p className={`twitch-status is-${api.status}`}>{statusText}</p>
    </Modal>
  );
}
