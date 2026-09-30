import React from 'react';
import { KEY } from '../game/state';
import { STATS_KEY } from '../game/stats';
import { GUESS_KEY } from '../game/guess';
import { downloadText, backupFileName, rawBackupText } from '../game/backup';
import { removeKey } from '../game/persist';
import { reportError } from '../analytics';

/**
 * Catches a crash anywhere in the game and offers a way out that matches what is saved (#164). A damaged run is cleared on its own, keeping your record
 * and Guess history; clearing everything is a separate, confirmed step, and a backup of exactly what is there can be downloaded first.
 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null; sure: boolean }> {
  state = { error: null as Error | null, sure: false };

  static getDerivedStateFromError(error: Error) { return { error }; }

  componentDidCatch(error: Error) { console.error('Major Mayhem crashed:', error); reportError(error, 'render'); }

  clearRun = () => { removeKey(KEY); location.reload(); };
  clearAll = () => { removeKey(KEY); removeKey(STATS_KEY); removeKey(GUESS_KEY); location.reload(); };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="page">
        <main className="crash" role="alert">
          <h1 className="logo">Major Mayhem</h1>
          <h2>Something broke</h2>
          <p>The game hit a problem it could not get past. Your saves are kept in this browser, and you choose what to clear. Start by downloading a backup of exactly what is saved: it is kept as it is, so it can be looked at or repaired later.</p>
          <div className="crash__actions">
            <button className="ghost-btn ghost-btn--big" onClick={() => downloadText(backupFileName(), rawBackupText())}>Download a backup</button>
            <button className="ghost-btn ghost-btn--big" onClick={() => location.reload()}>Try again</button>
          </div>
          <h3>Start over without losing your history</h3>
          <p>Clears only the run you had open. Your record, daily results and Guess history stay.</p>
          <div className="crash__actions"><button className="cta cta--orange" onClick={this.clearRun}>Clear the open run</button></div>
          <h3>Clear everything</h3>
          <p>{this.state.sure ? 'This removes your run, your lifetime record, your daily results and your Guess history from this browser, and cannot be undone.' : 'If clearing the run is not enough, this removes everything the game saved in this browser.'}</p>
          <div className="crash__actions">
            {this.state.sure
              ? <><button className="ghost-btn ghost-btn--big is-ask" onClick={this.clearAll}>Yes, clear everything</button><button className="ghost-btn ghost-btn--big" onClick={() => this.setState({ sure: false })}>Keep it</button></>
              : <button className="ghost-btn ghost-btn--big" onClick={() => this.setState({ sure: true })}>Clear everything…</button>}
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
