# Four Speakers

> Reference for the `speaker-crew` skill. Source: *The Motion Decision Core*, sections §29. Read only when the routing table triggers it.

Gallery families and rules for four.

## 29. Four speakers: the gallery families

Part III stops at three. Four is where "one conversation, one frame" starts to fail unless the frame is treated as a **gallery** rather than a stage. Everything from Part III carries (invariants, turn hysteresis, attribution, joins and leaves, clocks); what changes is the family set, the rules for dominance, and the point at which content forces the speakers into chips.

### 29.1 Families for four

| # | Family id | Geometry (16:9, fractions) | Notes |
|---|---|---|---|
| 18 | `quad-grid` | 2 × 2 tiles: (0.05, 0.06, 0.44, 0.38), (0.51, 0.06, 0.44, 0.38), (0.05, 0.46, 0.44, 0.38), (0.51, 0.46, 0.44, 0.38); gutter 0.02 W / 0.02 H; crop ≈ 1.85:1, eyes at 0.38 of each tile | the equal family for four; captions in the band below (0.85–0.95); no centre column, so shared cards go to a `topBand` or the family switches to `content-multi` |
| 19 | `dominant-3` | active (0.04, 0.06, 0.60, 0.77); rest column at x 0.68: three tiles 0.28 W × 0.24 H at y 0.06, 0.32, 0.58 (gap 0.02 H) | earned by `turn.dominantAfter` 12 s as before; rest tiles align eye rows among themselves; the column never scrolls |
| 20 | `content-multi` (4) | content (0.05, 0.06, 0.70, 0.77); chips Ø 0.11 W at x 0.80, y 0.06, 0.27, 0.48, 0.69 | fixed order, ring only; below Ø 0.11 W a face is < 35 % of the chip, so five or more speakers cannot use chips at all |
| 21 | `host-panel-3` | host column (0, 0, 0.44, 1) crop ≈ 1:1.4 (waist-up); three guest tiles stacked at x 0.48: 0.47 W × 0.28 H at y 0.06, 0.36, 0.66 | a host interviewing three; the host holds Next |
| — | `takeover` | as Part II | the only family that hides anyone, ≤ 8 s |

**Aspect restacks.** `9:16`: `quad-stack` — four 0.16 H tiles at y 0.09, 0.26, 0.43, 0.60 (captions at 0.70–0.77); the active speaker may instead take the upper 0.34 H with the other three in a row below (`dominant-3-stack`). `1:1`: `quad-grid` fills the square with 0.46 × 0.46 tiles; content-multi is unavailable (no room for a page beside four chips); content beats switch to `takeover` with an audio-only roster ring.

### 29.2 Rules that change at four

- **Default is the gallery.** `quad-grid` is the base; `dominant-3` is the exception, and it requires a longer floor: `turn.dominantAfter` rises to 15 s for four (a fourth face makes the switch costlier to read).
- **No eye-row alignment across rows.** Tiles align eye rows within their row only; the two rows keep the same crop tier so faces are the same size.
- **Ping-pong pins the gallery** at the same threshold (3 turns in 10 s) and additionally suppresses rings from flickering on interjections when two or more people interject in the same second (one ring per second, the longest utterance wins).
- **Content forces chips earlier.** A beat of class `beside` (Part V) that would fit beside one speaker does not fit beside four; from four speakers `beside` compiles as `content-multi` (chips) and `slot` uses the `topBand` only.
- **Attribution stays per tile.** Tabs sit on the tile's outer edge (left column left, right column right); a shared card in a gallery is a `topBand` or a `fullPlate`, never a centre column.
- **Identity.** Four straps in sequence take too long: introduce with **name pills from the first frame** and show each strap only when a speaker first takes the floor for ≥ 4 s (a two-second interjection earns no strap).
- **Joins and leaves** re-space the grid (2 → dual-box, 3 → trio-row, 4 → quad-grid); a leave from four drops to trio-row, never to a three-tile grid with a hole.
- **Audio-only members** are allowed up to two of four; each keeps its waveform ring and never takes `dominant-3`.

### 29.3 Tokens

| Token | Value |
|---|---|
| `tile.quad` | 0.44 W × 0.38 H, gutters 0.02 |
| `dominant3.active / rest` | (0.04, 0.06, 0.60, 0.77) / 0.28 W × 0.24 H at x 0.68 |
| `chips.multi` (4) | Ø 0.11 W, gap 0.03 H |
| `hostPanel3.host / guests` | 0.44 W column / 0.47 W × 0.28 H |
| `turn.dominantAfter` (4) | 15000 |
| `ring.maxPerSecond` | 1 |
| `identity.strapFloorMulti` | 4 s of floor before a strap |
| `speakers.max` | 4 in tiles; 5+ is a gallery product, out of scope |

### 29.4 Validator and phases

Errors: five or more tiles requested; a `beside` layout with four speakers; a strap for a speaker who never held the floor 4 s. Warnings: cross-row eye alignment attempted; a `dominant-3` switch under 15 s; more than two audio-only tiles. Phases: 4a inside Part III phase 16 (families and restacks); 4b inside phase 17 (rules) — no new phase.

# Part IV · The skill mechanism

Section 27 explains how ppt-master turns a brief into pages through a routed skill, and designs `motion-master`, the skill that takes those pages to planned, resolved and checked motion with the same devices.

