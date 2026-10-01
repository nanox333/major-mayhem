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
import { initAnalytics } from './analytics';
import { initSound } from './ui/sound';

initAnalytics();
initSound();

createRoot(document.getElementById('root')!).render(<ErrorBoundary><App /></ErrorBoundary>);
