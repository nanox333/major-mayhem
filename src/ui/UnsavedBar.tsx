import React from 'react';
import { backupFileName, backupText, createBackup, downloadText } from '../game/backup';
import { useUnsaved } from '../game/persist';
import type { Run } from '../game/state';

/**
 * Shown only after a real write to the browser has failed (#166), and gone again as soon as one succeeds. The game keeps working; this says that what you
 * do is not being kept, so a reload or closing the tab would lose it, and offers a file you can keep instead.
 */
export function UnsavedBar({ run }: { run?: Run }) {
  const what = useUnsaved();
  if (!what) return null;
  return (
    <div className="unsaved" role="status">
      <span><b>Not saved on this device.</b> This browser wouldn't keep {what}, so reloading or closing the tab loses it. You can keep playing.</span>
      <button type="button" className="link-btn" onClick={() => downloadText(backupFileName(), backupText(createBackup(run)))}>Download a backup</button>
    </div>
  );
}
