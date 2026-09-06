# Scope And Families

> Reference for the `speaker-crew` skill. Source: *The Motion Decision Core*, sections §18, §19. Read only when the routing table triggers it.

Scope, sources, invariants; the families for several speakers and the default rule for N.

## 18. Several speakers: scope, sources and invariants

Part II assumes one presenter. Part III reproduces every Part II decision for **two or three speakers on camera together**, in two configurations and one hybrid:

| Configuration | Feeds | Typical use | Where it lands |
|---|---|---|---|
| **co-located** | one camera, 2–3 people in one frame (a two-shot or three-shot) | a pair explaining at a desk, a whiteboard duo | family `dual-wide`; reframes are source crops (punch-ins) |
| **multi-feed** | one camera per speaker (local devices or remote WebRTC/recorded tracks) | interview, podcast, panel, host + remote guest | tile families (`dual-box`, `trio-row`, `dominant`, `host-guest`, `content-multi`, `split-duo`) |
| **hybrid** | host local, guest(s) remote | the common studio case | tile families; the host owns Next |

Four invariants carry over unchanged and two are added:

- **Stage state, not action** (Part II): the number of speakers, their tiles and the turn policy are compile inputs; a change of active speaker is *scheduled* like a reframe, never authored as an `Action`.
- **Every speaker is chrome** (L8): a person is never dimmed, never in "others", never the hero of a content action. Rest-state treatment is size, ring and at most a slight desaturation (`rest.saturate`), never opacity or blur on a face.
- **Motion downstream of the still**: each multi-speaker family is a static contract; every turn switch animates between two settled layouts.
- **Numbers live in §25.3**; theme values (ring colour, pill radius, speaker colours) live in `themes.ts`.
- **New: one conversation, one frame.** The default is *equal* treatment; *dominant* treatment is the exception, earned by a long turn. Interjections never move the camera. When two people talk at once, both are shown equally.
- **New: names before claims.** Nothing attributed to a person appears before that person has been named at least once in the scene.

**Speaker units.** `Geometry.units[]` of kind `speaker` gain `speakerId`, `role: host | guest`, `source: shared-camera | local | remote | audio-only`, a per-speaker face box, hands box, eye row, open side and colour (theme). The **host** is the speaker who owns Next by default (`stage.nextOwner`) and whose narration the planner treats as the spine; guests' sentences are attributed by diarization (§24).

**Scope.** 2–3 speakers. Four or more is a gallery problem (equal grid, active ring, no dominant) and is named as the next step, out of scope for phases 16–19.

---

## 19. Multi-speaker families

Geometry is (x, y, w, h) as fractions of the frame, 16:9 unless stated. Every tile crop is chest-up with **eyes at 0.38 of the tile height**; every tile keeps its own title-safe inset (0.05 of the tile) and its own face zones (§20). The caption band (0.85–0.95 H) is reserved in every family; identity straps and name pills sit *inside* their own tile.

| # | Family id | Geometry | Speakers | Suits | Notes |
|---|---|---|---|---|---|
| 11 | `dual-box` | tiles A (0.05, 0.10, 0.36, 0.73), B (0.59, 0.10, 0.36, 0.73); the centre column `gap.dual` 0.18 W is the shared column; crop ≈ 7:8 portrait, eye rows aligned at 0.377 H | 2, multi-feed | interview, conversation, contrast between two people | the default for two remote speakers; identity straps at y 0.72–0.82 H inside each tile; shared cards in the centre column |
| 12 | `dual-wide` | camera (0,0,1,1); two face zones; information in the **free region** (§20.3) | 2–3, co-located | a pair at a desk, a whiteboard duo | punch-in reframes by source crop (§23.3); no tiles |
| 13 | `host-guest` | host column (0, 0, 0.56, 1) crop ≈ 1:1; guest tile (0.60, 0.20, 0.35, 0.47) top set so both eye rows meet at 0.38 H; shared slot (0.60, 0.70, 0.35, 0.13) | 2, hybrid | host explains, guest reacts; a long host monologue with a guest present | the asymmetric default when the host speaks ≥ 70 % of a page |
| 14 | `dominant` | active tile (0.04, 0.06, 0.62, 0.77); rest column at x 0.70: tiles 0.26 W × 0.32 H at y 0.06 and 0.41 (gap 0.03 H); shared slot (0.70, 0.76, 0.26, 0.07) | 2–3, multi-feed | a long turn by one speaker; a guest presenting | rest tiles align eye rows among themselves; the active tile is a different tier and is exempt |
| 15 | `trio-row` | three tiles 0.29 W × 0.62 H at x 0.04 / 0.355 / 0.67, y 0.12; gutter `gap.trio` 0.025 W; name pills at y 0.75–0.82 under each | 3, multi-feed | panel, three-way conversation | the default for three |
| 16 | `content-multi` | content (0.05, 0.06, 0.70, 0.77); chip column at x 0.80: Ø `chips.multi` 0.14 W for two (y 0.10, 0.38) or 0.12 W for three (y 0.08, 0.32, 0.56), gap 0.03 H | 2–3 | a diagram, code or slide discussed by several people | chips keep a **fixed order** (host first); the active chip gets the ring, never a size change |
| 17 | `split-duo` | content (0.02, 0.08, 0.50, 0.75); two tiles (0.55, 0.06, 0.41, 0.37) and (0.55, 0.46, 0.41, 0.37), crop ≈ 2:1 | 2 | contrast beats, code beside two people | eye rows aligned per tile at 0.38 of the tile |
| — | `takeover` | as Part II | any | dense content, quote, chapter slab | all tiles hidden or under the plate; voices continue |

**Aspect restacks** (`Stage.aspect`): `9:16` → `dual-stack`: A (0.05, 0.09, 0.90, 0.34), B (0.05, 0.44, 0.90, 0.34); `trio-stack`: three 0.22 H tiles at y 0.09 / 0.32 / 0.55; captions at y 0.70–0.77 over the lowest tile's chest; content-multi → content band 0.09–0.40, chips in a row at y 0.42; `1:1` → two tiles (0.03, 0.05, 0.46, 0.50) and (0.51, 0.05, 0.46, 0.50), content or captions below 0.58 H; three → `trio-row` with 0.30 W × 0.36 H tiles at y 0.06.

### 19.1 Default selection rule for N speakers (rule; author override; planner proposes on cue)

Inputs: speaker count and sources, the beat's density and intent (L2), the **turn state** (§21), the block kind, aspect, and the matte/perf gate (a cut-out is allowed for at most `cutout.maxSpeakers` 1 speaker at a time).

1. **Count and source first.** Two multi-feed → `dual-box`; two co-located → `dual-wide`; three → `trio-row`.
2. **Density second.** Hero is a structure or ≥ 3 units → `content-multi`; a single figure or term → keep the speaker family and use a shared slot (§22.3).
3. **Intent third.** `contrast` between two speakers' positions → `split-duo` (or `dual-box` with paired cards); `introduce`/`recap` → the equal family.
4. **Turn state fourth.** One speaker holds the floor ≥ `turn.dominantAfter` 12 s with the others silent → `dominant` (or `host-guest` when the host holds it and there is one guest); a rapid exchange (≥ `turn.pingPongTurns` 3 turns within `turn.pingPongWindow` 10 s) → back to the equal family and stay there until the exchange ends.
5. **Rhythm caps.** Part II caps apply (`layout.minDwell` 4 s, ≤ 1 change per beat, no A→B→A within 10 s, 2–4 events per minute) plus: at most one size change per turn; never switch on an interjection.

---

