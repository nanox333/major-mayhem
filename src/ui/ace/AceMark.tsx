import React from 'react';
/** Original brush-cut event wordmark. Inline vector artwork, no font or texture download. */
export function AceMark() {
  return <svg viewBox="0 0 450 245" className="ace-mark" role="img" aria-label="ACE">
    <defs><mask id="ace-brush-cuts"><rect width="450" height="245" fill="white"/>
      <path d="M15 210 124 110M18 221 131 117M105 207 137 160M164 166 211 138M224 171 252 144M277 183 373 125M310 91 428 42M318 203 418 159" stroke="black" strokeWidth="2"/>
      <path d="m52 175 36-13-30 20m175-89 30-9-20 15m77 54 30-5-18 9M115 204l8-37-4 39" fill="black"/>
      {Array.from({length:23},(_,i)=>{const x=28+(i*61)%373,y=80+(i*37)%135;return <path key={i} d={`M${x} ${y}l${12+i%17} -${6+i%9}`} stroke="black" strokeWidth={i%3===0?2.8:.8}/>;})}
    </mask></defs>
    <g fill="currentColor" mask="url(#ace-brush-cuts)" transform="rotate(-8 225 122)">
      <path fillRule="evenodd" d="m18 224 33-61-8 2 35-45-6 1 56-79 37-6-12 11 7-2-20 101 10-3-6 27-12 5-12 55-11-16 2-34-8 37 2-43-43 6-37 47 7-26Zm72-81 35-5 9-55Z"/>
      <path d="m262 56-8 39-23-4-4-17-12 4-27 26-22 34-7 23 8 9 24-6 43-25-8 24 11-4-42 36-33 9-22-13-7-23 12-40 31-45 35-29 29-9Z"/>
      <path d="m285 49 129-8-24 14 31-1-45 20-69 7-18 35 79-6-19 13 15 3-36 16-53 5-19 39 123-14-30 19 17 3-91 22-32 1-17 8 17-47-5 1 21-41-6 1 27-48-14 1Z"/>
      <path d="m7 229 53-49-31 41Zm88-6 18-27-12 39Zm163-24 38-1-52 15Zm132-147 47-7-27 10Zm-213 58 15-25-8 27Z"/>
    </g>
  </svg>;
}
