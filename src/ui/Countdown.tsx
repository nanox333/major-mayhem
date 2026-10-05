import React, { useEffect, useState } from 'react';
import { nowDate } from '../game/clock';

/** Time until the next local midnight, when the next daily unlocks. */
function untilMidnight(now = nowDate()) {
  const next = new Date(now); next.setHours(24, 0, 0, 0);
  const mins = Math.max(0, Math.ceil((next.getTime() - now.getTime()) / 60000));
  return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
}

export function NextDaily() {
  const [left, setLeft] = useState(untilMidnight);
  useEffect(() => { const t = setInterval(() => setLeft(untilMidnight()), 20000); return () => clearInterval(t); }, []);
  return <span className="next-daily">Next daily in {left}</span>;
}
