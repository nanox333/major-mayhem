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
