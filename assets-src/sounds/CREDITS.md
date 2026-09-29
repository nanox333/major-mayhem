# Sound credits

Every sound effect in the game is a recorded sample from one of four sound packs by [Kenney](https://kenney.nl), released under
[Creative Commons Zero (CC0 1.0)](https://creativecommons.org/publicdomain/zero/1.0/): free for personal, educational and commercial use,
no attribution required (given here anyway). Each pack's own licence text sits alongside this file (`LICENSE-kenney-*.txt`).

| Pack | Page | Samples used |
| --- | --- | --- |
| Interface Sounds | https://kenney.nl/assets/interface-sounds | 27 |
| Impact Sounds | https://kenney.nl/assets/impact-sounds | 21 |
| Casino Audio | https://kenney.nl/assets/casino-audio | 3 |
| Sci-fi Sounds | https://kenney.nl/assets/sci-fi-sounds | 4 |

## How they get into the game

1. The originals (`*.ogg`, unmodified copies of Kenney's files, renamed) live in this folder.
2. `npm run sounds` decodes each one, mixes it to mono, trims silence, levels it and encodes a small mp3 into `src/sounds/`.
3. `src/ui/sfx.ts` lists which samples make up each game event (layers, variants, levels). The build inlines the mp3s.

To change a sound: drop a new ogg/wav/mp3/flac here, run `npm run sounds`, and point a recipe in `src/ui/sfx.ts` at its id
(the file name without extension). `src/ui/sfx.test.ts` fails if a recipe names a missing sample or a sample goes unused.

## Files

| File here | Original name | Pack |
| --- | --- | --- |
| `cas-shove-2.ogg` | `card-shove-2.ogg` | Casino Audio |
| `cas-slide-5.ogg` | `card-slide-5.ogg` | Casino Audio |
| `cas-slide-6.ogg` | `card-slide-6.ogg` | Casino Audio |
| `imp-bell-heavy-000.ogg` | `impactBell_heavy_000.ogg` | Impact Sounds |
| `imp-bell-heavy-001.ogg` | `impactBell_heavy_001.ogg` | Impact Sounds |
| `imp-bell-heavy-002.ogg` | `impactBell_heavy_002.ogg` | Impact Sounds |
| `imp-bell-heavy-003.ogg` | `impactBell_heavy_003.ogg` | Impact Sounds |
| `imp-metal-heavy-000.ogg` | `impactMetal_heavy_000.ogg` | Impact Sounds |
| `imp-metal-heavy-001.ogg` | `impactMetal_heavy_001.ogg` | Impact Sounds |
| `imp-metal-heavy-002.ogg` | `impactMetal_heavy_002.ogg` | Impact Sounds |
| `imp-metal-heavy-003.ogg` | `impactMetal_heavy_003.ogg` | Impact Sounds |
| `imp-metal-light-001.ogg` | `impactMetal_light_001.ogg` | Impact Sounds |
| `imp-metal-light-004.ogg` | `impactMetal_light_004.ogg` | Impact Sounds |
| `imp-metal-medium-002.ogg` | `impactMetal_medium_002.ogg` | Impact Sounds |
| `imp-metal-medium-003.ogg` | `impactMetal_medium_003.ogg` | Impact Sounds |
| `imp-plate-heavy-000.ogg` | `impactPlate_heavy_000.ogg` | Impact Sounds |
| `imp-plate-heavy-001.ogg` | `impactPlate_heavy_001.ogg` | Impact Sounds |
| `imp-plate-heavy-002.ogg` | `impactPlate_heavy_002.ogg` | Impact Sounds |
| `imp-plate-heavy-003.ogg` | `impactPlate_heavy_003.ogg` | Impact Sounds |
| `imp-plate-light-000.ogg` | `impactPlate_light_000.ogg` | Impact Sounds |
| `imp-plate-light-003.ogg` | `impactPlate_light_003.ogg` | Impact Sounds |
| `imp-punch-heavy-000.ogg` | `impactPunch_heavy_000.ogg` | Impact Sounds |
| `imp-punch-heavy-003.ogg` | `impactPunch_heavy_003.ogg` | Impact Sounds |
| `imp-soft-heavy-001.ogg` | `impactSoft_heavy_001.ogg` | Impact Sounds |
| `int-click-001.ogg` | `click_001.ogg` | Interface Sounds |
| `int-click-002.ogg` | `click_002.ogg` | Interface Sounds |
| `int-click-003.ogg` | `click_003.ogg` | Interface Sounds |
| `int-click-005.ogg` | `click_005.ogg` | Interface Sounds |
| `int-confirmation-001.ogg` | `confirmation_001.ogg` | Interface Sounds |
| `int-confirmation-002.ogg` | `confirmation_002.ogg` | Interface Sounds |
| `int-confirmation-003.ogg` | `confirmation_003.ogg` | Interface Sounds |
| `int-confirmation-004.ogg` | `confirmation_004.ogg` | Interface Sounds |
| `int-drop-002.ogg` | `drop_002.ogg` | Interface Sounds |
| `int-drop-003.ogg` | `drop_003.ogg` | Interface Sounds |
| `int-drop-004.ogg` | `drop_004.ogg` | Interface Sounds |
| `int-error-005.ogg` | `error_005.ogg` | Interface Sounds |
| `int-glass-001.ogg` | `glass_001.ogg` | Interface Sounds |
| `int-glass-002.ogg` | `glass_002.ogg` | Interface Sounds |
| `int-glass-003.ogg` | `glass_003.ogg` | Interface Sounds |
| `int-glass-004.ogg` | `glass_004.ogg` | Interface Sounds |
| `int-glass-005.ogg` | `glass_005.ogg` | Interface Sounds |
| `int-pluck-001.ogg` | `pluck_001.ogg` | Interface Sounds |
| `int-pluck-002.ogg` | `pluck_002.ogg` | Interface Sounds |
| `int-question-003.ogg` | `question_003.ogg` | Interface Sounds |
| `int-select-001.ogg` | `select_001.ogg` | Interface Sounds |
| `int-select-002.ogg` | `select_002.ogg` | Interface Sounds |
| `int-select-003.ogg` | `select_003.ogg` | Interface Sounds |
| `int-select-004.ogg` | `select_004.ogg` | Interface Sounds |
| `int-select-006.ogg` | `select_006.ogg` | Interface Sounds |
| `int-tick-001.ogg` | `tick_001.ogg` | Interface Sounds |
| `int-tick-002.ogg` | `tick_002.ogg` | Interface Sounds |
| `sci-door-open-000.ogg` | `doorOpen_000.ogg` | Sci-fi Sounds |
| `sci-door-open-001.ogg` | `doorOpen_001.ogg` | Sci-fi Sounds |
| `sci-door-open-002.ogg` | `doorOpen_002.ogg` | Sci-fi Sounds |
| `sci-sub-boom-001.ogg` | `lowFrequency_explosion_001.ogg` | Sci-fi Sounds |
