import { useEffect, useState } from 'react';

/** Suspend the clock under a dialog or hidden tab without changing the player's pause choice. */
export function usePlaybackCovered() {
  const read = () => document.hidden || !!document.querySelector('[role="dialog"]');
  const [covered, setCovered] = useState(read);
  useEffect(() => {
    const update = () => setCovered(read());
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('visibilitychange', update);
    update();
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', update); };
  }, []);
  return covered;
}
