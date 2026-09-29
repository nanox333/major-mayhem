// Twitch chat votes: the game reads a channel's chat anonymously (read-only, no login, no server) over Twitch's IRC
// WebSocket, and viewers vote on the decision on screen by typing a number or a name.

export interface ChatMsg { user: string; text: string }
export interface VoteOption { id: string; label: string; aliases: string[] }

export const TWITCH_WS = 'wss://irc-ws.chat.twitch.tv:443';
export const validChannel = (c: string) => /^[a-zA-Z0-9_]{3,25}$/.test(c);

/** One IRC line: a chat message, a PING to answer, or something to ignore. */
export function parseIrc(line: string): { msg: ChatMsg } | { ping: string } | null {
  if (line.startsWith('PING')) return { ping: line.slice(5) };
  // Optional @tags, then ":nick!nick@nick.tmi.twitch.tv PRIVMSG #channel :text"
  const m = /^(?:@(\S+) )?:([^!\s]+)!\S+ PRIVMSG #\S+ :(.*)$/.exec(line);
  if (!m) return null;
  const display = m[1]?.split(';').find((t) => t.startsWith('display-name='))?.slice(13);
  return { msg: { user: (display || m[2]).toLowerCase(), text: m[3] } };
}

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '');

/**
 * Which option a chat message votes for: the whole message (after an optional "!") must be the option's number or one
 * of its names, so ordinary chatter doesn't count as a vote.
 */
export function matchVote(text: string, options: VoteOption[]): string | null {
  const t = norm(text.trim().replace(/^!/, ''));
  if (!t) return null;
  const n = /^\d+$/.test(t) ? Number(t) : NaN;
  if (n >= 1 && n <= options.length) return options[n - 1].id;
  return options.find((o) => o.aliases.some((a) => norm(a) === t))?.id ?? null;
}

/** Votes per option (one vote per viewer; a later vote replaces an earlier one). */
export const tally = (votes: Map<string, string>, options: VoteOption[]) => options.map((o) => [...votes.values()].filter((v) => v === o.id).length);

/** The winning option: most votes, ties to the first listed. Null when nobody voted. */
export function winner(votes: Map<string, string>, options: VoteOption[]): string | null {
  const counts = tally(votes, options);
  const best = Math.max(0, ...counts);
  return best === 0 ? null : options[counts.indexOf(best)].id;
}

/** A read-only connection to one channel's chat. Reconnects once if the socket drops. */
export class TwitchChat {
  private ws: WebSocket | null = null;
  private closed = false;
  private retried = false;
  constructor(private channel: string, private onMsg: (m: ChatMsg) => void, private onStatus: (s: 'connecting' | 'live' | 'error' | 'off') => void) {
    this.open();
  }
  private open() {
    this.onStatus('connecting');
    const ws = new WebSocket(TWITCH_WS);
    this.ws = ws;
    const chan = this.channel.toLowerCase();
    ws.onopen = () => {
      ws.send('PASS SCHMOOPIIE');
      ws.send(`NICK justinfan${Math.floor(10000 + Math.random() * 89999)}`);
      ws.send(`JOIN #${chan}`);
    };
    ws.onmessage = (e) => {
      for (const line of String(e.data).split('\r\n')) {
        if (!line) continue;
        if (/ JOIN #/.test(line)) { this.onStatus('live'); continue; }
        const p = parseIrc(line);
        if (p && 'ping' in p) ws.send(`PONG ${p.ping}`);
        else if (p) this.onMsg(p.msg);
      }
    };
    ws.onerror = () => this.onStatus('error');
    ws.onclose = () => {
      if (this.closed) return this.onStatus('off');
      if (!this.retried) { this.retried = true; setTimeout(() => !this.closed && this.open(), 3000); return; }
      this.onStatus('error');
    };
  }
  close() { this.closed = true; this.ws?.close(); }
}
