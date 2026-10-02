import React, { useEffect } from 'react';

// The draft's atmosphere (#225), made of layers, back to front:
//   a near-black page with a grain you only see when you look for it  ->  the arena photograph across the top  ->  vertical and horizontal black fades with a
//   faint warm glow  ->  the interface.
// The arena is src/assets/draft/major-arena-bg.webp and the grain tactical-noise.webp; both are referenced from draft-scene.css, so a new file with the same name
// replaces them. It is decoration only (aria-hidden), static, and dark where the cards sit so it never sits behind body text at strength.
// While it is on screen the page root carries `has-scene`, which is how the grain and the slightly softer orange reach the body and the top bar.
export function DraftScene() {
  useEffect(() => {
    document.documentElement.classList.add('has-scene');
    return () => document.documentElement.classList.remove('has-scene');
  }, []);
  return (
    <div className="draft-scene" aria-hidden="true">
      <div className="draft-scene__arena" />
      <div className="draft-scene__light" />
    </div>
  );
}
