import React, { useState } from 'react';
import { Run, draftRounds } from '../game/state';
import { Preview } from '../game/draftui';
import { Modal } from './Modal';
import { LineupPanel } from './Lineup';
import { DraftSidebar } from './DraftSidebar';
import { slotsOf } from './TeamStrip';

export function MobileLineup({ s, preview, onHelp }: { s: Run; preview: Preview | null; onHelp: () => void }) {
  const [open, setOpen] = useState(false);
  const filled = slotsOf(s).filter(x => x.who).length;
  return <div className="mobile-lineup">
    <button className="mobile-lineup__trigger" onClick={() => setOpen(true)} aria-haspopup="dialog"><b>Your lineup · {filled}/{draftRounds(s)}</b><span aria-hidden="true">{slotsOf(s).map(x => x.who ? '●' : '○').join(' ')} ›</span></button>
    {open && <Modal label="Your lineup" sheet onClose={() => setOpen(false)}>
      <LineupPanel s={s} preview={preview} />
      <DraftSidebar s={s} preview={preview} onChemistryHelp={() => { setOpen(false); onHelp(); }} />
    </Modal>}
  </div>;
}
