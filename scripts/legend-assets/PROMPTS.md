# Art for the legendary-moment scenes

Four of the images were made with ChatGPT's image generation (the account of the project owner), then cut out in the browser and saved as WebP; the rest are drawn in code by `generate.html`.

| File | How | Prompt (shortened) |
| --- | --- | --- |
| `hole.webp` | ChatGPT, kept on black (the page blends it with `screen`) | A realistic bullet hole in a sheet of glass seen straight on: small dark crater, crushed white zone, sharp radial and ring cracks, white on pure black, square, nothing else. |
| `blast.webp` | ChatGPT, kept on black (`screen`) | A bright white-hot core with an orange and yellow starburst of sharp spikes and a soft glow, on pure black, square. |
| `bomb.webp` | ChatGPT on green, keyed to transparent | A planted tactical C4 bomb: dark gunmetal case with straps, an empty dark LCD window (the page draws the numbers on it), keypad, red LED, antenna and wires; front view, wide, on pure green (#00FF00). |
| `awp.webp` | ChatGPT on green, keyed to transparent | A bolt-action sniper rifle with a scope in the style of the AWP: long barrel and muzzle brake, olive stock, black receiver, side view, muzzle to the right, on pure green. |

The green is removed with a chroma key (`dominance = g - max(r, b)`, softened between 28 and 98) and the images are scaled to 448 to 900 pixels wide. No text or logos were in any of the results. The image generator may change; if you redo these, keep the framing (centred, nothing else in the picture) so the CSS positions in `src/styles/legend.css` still line up (the bomb's display window and LED, the rifle's muzzle).
