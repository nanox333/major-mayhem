import React from 'react';

// The draft's atmosphere (#225), made of layers, back to front:
//   a near-black page with a faint tactical grain  ->  the arena photograph across the top  ->  a dark scrim and warm radial light  ->  the interface.
// The arena is src/assets/draft/major-arena-bg.webp and the grain tactical-noise.webp; both are referenced from draft-scene.css, so a new file with the same name
// replaces them. It is decoration only (aria-hidden), static, and fades to almost black below the roster area so it never sits behind body text at full strength.
export function DraftScene() {
  return (
    <div className="draft-scene" aria-hidden="true">
      <div className="draft-scene__arena" />
      <div className="draft-scene__light" />
    </div>
  );
}
