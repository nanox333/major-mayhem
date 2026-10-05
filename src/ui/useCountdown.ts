import { useEffect, useState } from 'react';
import { clockText, msUntilMidnight, spokenLeft } from '../game/home';
import { today } from '../game/state';
import { nowDate } from '../game/clock';

export interface Countdown {
  /** "23:14:27": the time to the next local midnight, for the eye. */
  clock: string;
  /** "Next daily in 7 hours": for a screen reader, changing by the hour and then the minute. */
  spoken: string;
  /** Today's date (YYYY-MM-DD, local). It changes at midnight, so anything built from it moves on to the new daily without a reload. */
  day: string;
}

/**
 * The daily countdown (#117): one interval per second, cleared on unmount, stopped while the tab is hidden, and corrected the moment
 * the tab is visible again (a hidden tab's timers can run late). It counts to local midnight, never UTC (#26).
 */
export function useCountdown(): Countdown {
  const [now, setNow] = useState(nowDate);
  useEffect(() => {
    let id: ReturnType<typeof setInterval> | undefined;
    const tick = () => setNow(nowDate());
    const start = () => { if (id === undefined) id = setInterval(tick, 1000); };
    const stop = () => { if (id !== undefined) { clearInterval(id); id = undefined; } };
    const onVisible = () => { if (document.hidden) stop(); else { tick(); start(); } };
    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisible);
    return () => { stop(); document.removeEventListener('visibilitychange', onVisible); };
  }, []);
  const ms = msUntilMidnight(now);
  return { clock: clockText(ms), spoken: spokenLeft(ms), day: today(now) };
}
