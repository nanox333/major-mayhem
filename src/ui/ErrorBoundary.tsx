import React from 'react';
import { KEY } from '../game/state';
import { reportError } from '../analytics';

/**
 * Catches a crash anywhere in the game and offers a way out. A saved run that no longer fits the code or data
 * would otherwise blank the page on every load; "Reset run" clears only the run save and keeps lifetime stats.
 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) { return { error }; }

  componentDidCatch(error: Error) { console.error('Major Mayhem crashed:', error); reportError(error, 'render'); }

  reset = () => {
    try { localStorage.removeItem(KEY); } catch { /* storage unavailable */ }
    location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="page">
        <main className="crash" role="alert">
          <h1 className="logo">Major Mayhem</h1>
          <h2>Something broke loading your run</h2>
          <p>Your saved run doesn't fit this version of the game. Resetting starts a new run; your lifetime stats and daily results stay.</p>
          <div className="crash__actions">
            <button className="cta cta--orange" onClick={this.reset}>Reset run</button>
            <button className="ghost-btn" onClick={() => location.reload()}>Try again</button>
          </div>
          <details>
            <summary>Error details</summary>
            <code>{this.state.error.message}</code>
          </details>
        </main>
      </div>
    );
  }
}
