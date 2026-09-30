import React from 'react';

// Interface icons, drawn for this game on a 24px grid: stroke only, currentColor, decorative (aria-hidden), no dependency. The names on the buttons carry the meaning.
// #114 grows this set for the rest of the new screens.

const Svg = ({ children, size = 20, fill = false }: { children: React.ReactNode; size?: number; fill?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{children}</svg>
);
type P = { size?: number };

/** An opened case: the Draft step. */
export const CaseIcon = (p: P) => <Svg {...p}><path d="M12 3 4 7.5v9L12 21l8-4.5v-9zM4 7.5l8 4.5 8-4.5M12 12v9" /></Svg>;
/** Your five and their staff: the Lobby step. */
export const RosterIcon = (p: P) => <Svg {...p}><path d="M9 11a3.2 3.2 0 1 0 0-6.4A3.2 3.2 0 0 0 9 11zM3 20v-.8A5.2 5.2 0 0 1 8.2 14h1.6a5.2 5.2 0 0 1 5.2 5.2V20M16.5 5.2a3 3 0 0 1 0 5.6M18.5 14.4A4.6 4.6 0 0 1 21.6 19v1" /></Svg>;
/** The Major itself. */
export const TrophyIcon = (p: P) => <Svg {...p}><path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4.5v1A3.5 3.5 0 0 0 8 10.5M16 6h3.5v1a3.5 3.5 0 0 1-3.5 3.5M12 13v4M8.5 20.5h7M10 17h4" /></Svg>;
/** The finish line: the Results step. */
export const FlagIcon = (p: P) => <Svg {...p}><path d="M5 21V4M5 5h12.5L15 9l2.5 4H5" /></Svg>;
/** Guess the pro. */
export const CrosshairIcon = (p: P) => <Svg {...p}><path d="M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 2v4M12 18v4M2 12h4M18 12h4" /></Svg>;
/** The coach's slot: a clipboard. */
export const CoachIcon = (p: P) => <Svg {...p}><path d="M9 4h6v3H9zM7 5.5H6a1 1 0 0 0-1 1V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6.5a1 1 0 0 0-1-1h-1M9 12h6M9 16h4" /></Svg>;
/** The bench slot: a bench. */
export const BenchIcon = (p: P) => <Svg {...p}><path d="M3 10h18M5 10v9M19 10v9M3 14.5h18M6 10V6.5h12V10" /></Svg>;
export const HelpIcon = (p: P) => <Svg {...p}><path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.4 9.4a2.7 2.7 0 1 1 3.8 2.5c-.8.4-1.2 1-1.2 1.8M12 17h.01" /></Svg>;
export const SoundIcon = ({ on, ...p }: P & { on: boolean }) => (
  <Svg {...p}><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" fill="currentColor" />{on ? <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /> : <path d="M16 9.5l5 5M21 9.5l-5 5" />}</Svg>
);
export const StatsIcon = (p: P) => <Svg {...p}><path d="M5 20V12M12 20V5M19 20v-5" /></Svg>;
export const TwitchIcon = (p: P) => <Svg {...p}><path d="M4 3h16v11l-4 4h-4l-3 3v-3H4zM11 7v4M15 7v4" /></Svg>;
export const RefreshIcon = (p: P) => <Svg {...p}><path d="M4 12a8 8 0 0 1 14-5.3M20 4v5h-5M20 12a8 8 0 0 1-14 5.3M4 20v-5h5" /></Svg>;
export const MoreIcon = (p: P) => <Svg {...p} fill><circle cx="5" cy="12" r="1.7" stroke="none" /><circle cx="12" cy="12" r="1.7" stroke="none" /><circle cx="19" cy="12" r="1.7" stroke="none" /></Svg>;
export const CheckIcon = (p: P) => <Svg {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></Svg>;
export const ChevronLeftIcon = (p: P) => <Svg {...p}><path d="M15 5l-7 7 7 7" /></Svg>;
export const ChevronDownIcon = (p: P) => <Svg {...p}><path d="M6 9l6 6 6-6" /></Svg>;
export const CalendarIcon = (p: P) => <Svg {...p}><path d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" /></Svg>;
export const InfinityIcon = (p: P) => <Svg {...p}><path d="M12 12c-1.5-2.5-3-4-5-4a4 4 0 0 0 0 8c2 0 3.5-1.5 5-4zm0 0c1.5 2.5 3 4 5 4a4 4 0 0 0 0-8c-2 0-3.5 1.5-5 4z" /></Svg>;
export const FlameIcon = (p: P) => <Svg {...p}><path d="M12 3c1 3.5 4.5 5 4.5 9a4.5 4.5 0 0 1-9 0c0-1.7.8-3 1.7-3.8.3 1.3 1 1.9 1.6 2.1C11 8 10.5 5.5 12 3z" /></Svg>;
export const StarIcon = (p: P) => <Svg {...p}><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" /></Svg>;
export const HomeIcon = (p: P) => <Svg {...p}><path d="M4 11l8-7 8 7M6 10v9h12v-9M10 19v-5h4v5" /></Svg>;
export const MapPinIcon = (p: P) => <Svg {...p}><path d="M12 21s6-5.5 6-10a6 6 0 1 0-12 0c0 4.5 6 10 6 10zM12 13a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" /></Svg>;
export const ArrowRightIcon = (p: P) => <Svg {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Svg>;
export const ShareIcon = (p: P) => <Svg {...p}><path d="M4 12v7h16v-7M12 3v12M8 7l4-4 4 4" /></Svg>;
export const ClockIcon = (p: P) => <Svg {...p}><path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2" /></Svg>;
/** A medal: a placement below first. */
export const MedalIcon = (p: P) => <Svg {...p}><path d="M12 21a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11zM9 10.5 7 3h4l1 4 1-4h4l-2 7.5" /></Svg>;
export const PlusIcon = (p: P) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>;
