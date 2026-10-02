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
import './styles/stats-page.css';
import './styles/guess-page.css';
import './styles/setup-page.css';
import './styles/lobby-page.css';
import './styles/match-page.css';
import './styles/shell.css';
import { initAnalytics } from './analytics';
import { initSound } from './ui/sound';

initAnalytics();
initSound();

createRoot(document.getElementById('root')!).render(<ErrorBoundary><App /></ErrorBoundary>);
