import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './ui/ErrorBoundary';
import './styles.css';
import './styles/editorial-home.css';
import './styles/editorial-draft.css';
import './styles/editorial-live.css';
import './styles/editorial-results.css';
import './styles/editorial-finish.css';
import './styles/roster-archive.css';
import './styles/draft-scene.css';
import './styles/draft-open.css';
import './styles/draft-status.css';
import './styles/stats-page.css';
import './styles/guess-page.css';
import './styles/duo.css';
import './styles/setup-page.css';
import './styles/lobby-page.css';
import './styles/match-page.css';
import './styles/results-page.css';
import './styles/legend.css';
import './styles/shell.css';
import './styles/help-chemistry.css';
import './styles/roster-sheet.css';
import './styles/phone.css';
import { initAnalytics } from './analytics';
import { initSound } from './ui/sound';

initAnalytics();
initSound();

createRoot(document.getElementById('root')!).render(<ErrorBoundary><App /></ErrorBoundary>);

// Warm the CPU asset cache after the initial interface paints; no renderer is created.
if (!matchMedia('(prefers-reduced-motion: reduce)').matches) setTimeout(() => {
  import('./ui/legend3d/assets').then(m => m.preloadNoscope()).catch(() => {});
}, 800);
