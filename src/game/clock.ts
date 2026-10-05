// "What time is it" for the game. Always the real time, except when the debug menu has set an offset (to see a midnight rollover or another day
// without waiting). The offset is read only while the debug tools are on, so nothing here can affect a normal visit.
const OFFSET_KEY = 'mm-debug-clock';
const debugOn = () => { try { return localStorage.getItem('mm-debug') === '1' || /[?&]debug\b/.test(location.search + location.hash); } catch { return false; } };

/** The debug clock offset in milliseconds; 0 when the debug tools are off. */
export const clockOffset = (): number => {
  if (!debugOn()) return 0;
  try { return Number(localStorage.getItem(OFFSET_KEY)) || 0; } catch { return 0; }
};
export const setClockOffset = (ms: number) => { try { ms ? localStorage.setItem(OFFSET_KEY, String(Math.round(ms))) : localStorage.removeItem(OFFSET_KEY); } catch { /* storage unavailable */ } };
/** The current moment, including the debug offset. */
export const nowDate = (): Date => new Date(Date.now() + clockOffset());
