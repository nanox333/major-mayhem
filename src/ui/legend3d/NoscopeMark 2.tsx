import React, { useId } from 'react';
/** Repo-native distressed stencil title, matching the game's Saira typography. */
export function NoscopeMark() {
  const id=useId().replace(/:/g,'');
  return <svg className="noscope-mark" viewBox="0 0 900 205" role="img" aria-label="NOSCOPE">
    <defs><mask id={id}><rect width="900" height="205" fill="white" />
      {Array.from({length:48},(_,i)=><rect key={i} x={120+(i*137)%660} y={45+(i*31)%108} width={2+i%9} height={1+i%3} fill="black" transform={`rotate(-14 ${120+(i*137)%660} ${45+(i*31)%108})`} />)}
      <path d="M160 129l122-9-74 17z M528 67l122-8-67 15z M663 144l71-12-36 17z" fill="black" />
    </mask></defs>
    <g stroke="#f37a30" fill="none" opacity=".65"><path d="M30 15h840M30 190h840M20 92v22M9 103h22M880 92v22M869 103h22" /><path d="M447 12l3 3-3 3-3-3zM447 187l3 3-3 3-3-3z" fill="#f37a30" /></g>
    <g transform="translate(32 0) skewX(-12)"><text x="450" y="151" textAnchor="middle" fontFamily="Saira Condensed, sans-serif" fontWeight="800" fontStyle="italic" fontSize="146" letterSpacing="9" fill="#ff781c" mask={`url(#${id})`}>NOSCOPE</text></g>
  </svg>;
}
