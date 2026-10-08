import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { ArrowRightIcon } from '../ui/icons';
import { useT } from '../i18n';
import { Challenge, NAME_KEY, encodeChallenge, newChallengeSeed } from '../game/challenge';
import { copyText, pageUrl } from '../game/share';
import { cleanName } from '../game/duel';

/**
 * The link you send before drafting anything (#challenge). It starts a friend on a free draft from a seed; they send their team back
 * as a draft duel, and you draft against it. Built like the duel invitation (src/styles/duel-invite.css).
 */
export function ChallengeDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [name, setName] = useState(() => { try { return localStorage.getItem(NAME_KEY) ?? ''; } catch { return ''; } });
  const [seed] = useState(newChallengeSeed);
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const link = `${pageUrl() ?? __SITE__.url}#c=${encodeChallenge({ name, seed })}`;
  const copy = async () => {
    try { localStorage.setItem(NAME_KEY, name); } catch { /* storage unavailable */ }
    const ok = await copyText(link);
    setState(ok ? 'copied' : 'failed');
    setTimeout(() => setState('idle'), 2400);
  };
  return (
    <Modal label={t('challenge.dialogTitle')} onClose={onClose}>
      <div className="dv">
        <header className="dv__head">
          <span className="dv__kick">{t('challenge.kicker')}</span>
          <h3>{t('challenge.dialogTitle')}</h3>
          <p>{t('challenge.dialogBody')}</p>
        </header>
        <section className="dv__sec" aria-labelledby="ch-send">
          <h4 id="ch-send">{t('challenge.sendTitle')}</h4>
          <label className="dv__field">
            <span>{t('challenge.nameLabel')}</span>
            <input className="dv__input" value={name} maxLength={24} placeholder={t('challenge.namePlaceholder')} onChange={(e) => setName(e.target.value)} />
          </label>
          <p className="dv__link" aria-label={t('challenge.linkLabel')}>{link}</p>
        </section>
        <div className="dv__actions">
          <button type="button" className="mbtn mbtn--main" onClick={copy}>
            <span>{state === 'copied' ? t('challenge.copied') : state === 'failed' ? t('challenge.copyFailed') : t('challenge.copy')}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * A banner on the Home for a challenge waiting in its own slot. It sits above the page, and opens the challenge from there: your own run is not touched.
 */
export function ChallengeBanner({ waiting, onOpen }: { waiting: { from: string; finished: boolean }; onOpen: () => void }) {
  const t = useT();
  return (
    <section className="challenge-banner" aria-label={t('challenge.kicker')}>
      <span className="dv__kick">{t('challenge.kicker')}</span>
      <p>{waiting.finished ? t('challenge.bannerFinished', { name: waiting.from }) : t('challenge.bannerOpen', { name: waiting.from })}</p>
      <button type="button" className="ghost-btn" onClick={onOpen}>{t('challenge.bannerButton')}</button>
    </section>
  );
}

/** The challenge a friend sent you: start drafting from its seed. Shown in place of the duel invitation when the link is a challenge. */
export function ChallengeInvite({ challenge, replaces, onAccept, onClose }: { challenge: Challenge | null; /** A challenge is already waiting in its slot, so accepting this one replaces it. */ replaces: boolean; onAccept: (c: Challenge) => void; onClose: () => void }) {
  const t = useT();
  return (
    <Modal label={t('challenge.kicker')} onClose={onClose}>
      <div className="dv">
        {challenge ? (
          <>
            <header className="dv__head">
              <span className="dv__kick">{t('challenge.kicker')}</span>
              <h3>{cleanName(challenge.name)} <em>{t('challenge.challenges')}</em></h3>
              <p>{t('challenge.inviteBody', { name: cleanName(challenge.name) })}</p>
            </header>
            <section className="dv__sec" aria-labelledby="ch-steps">
              <h4 id="ch-steps">{t('challenge.stepsTitle')}</h4>
              <ol className="dv__terms">
                <li>{t('challenge.step1')}</li>
                <li>{t('challenge.step2')}</li>
                <li>{t('challenge.step3', { name: cleanName(challenge.name) })}</li>
              </ol>
            </section>
            {replaces && <p className="dv__note">{t('challenge.replaces')}</p>}
            <div className="dv__actions">
              <button type="button" className="mbtn mbtn--main" onClick={() => onAccept(challenge)}><span>{t('challenge.start')}</span><ArrowRightIcon size={22} /></button>
            </div>
          </>
        ) : (
          <header className="dv__head">
            <span className="dv__kick">{t('challenge.kicker')}</span>
            <h3>{t('challenge.badTitle')}</h3>
            <p>{t('challenge.badBody')}</p>
          </header>
        )}
      </div>
    </Modal>
  );
}
