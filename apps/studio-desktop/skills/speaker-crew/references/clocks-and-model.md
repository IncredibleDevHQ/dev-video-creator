# Clocks And Model

> Reference for the `speaker-crew` skill. Source: *The Motion Decision Core*, sections §24, §25. Read only when the routing table triggers it.

Timing with several voices; data model, compositing, tokens, ownership, validator, worked examples, phases 16–19.

## 24. Timing, clocks and the take with several voices

- **Cues.** The plan's narration gains `speaker` per sentence. Publish aligns each step to *its speaker's* word onset; a shared count lands on the onset of whoever states the figure. Studio Next belongs to `stage.nextOwner` (the host); per-speaker hotkeys are optional and only fire attributed overlays on that speaker's own tile.
- **Overlap.** A value overlay whose landing falls inside an overlap is delayed to the next clear onset if that is within `value.overlapDelayMax` 1000 ms, otherwise dropped with a warning; a place overlay (panel, card) is not delayed.
- **Clearing.** Part II clearing rules apply per speaker: an attributed overlay clears `gap.overlayClear` 300 ms before the *next speaker's* first cue, so a hand-over never happens under someone else's card.
- **One reference clock.** `Take.media` becomes an array of feeds; `t0` is the **host camera** recorder's first frame `mediaTime`; every other feed carries a measured `offsetMs` from a sync beacon at take start (a clap or a tone on all mics; remote feeds add their RTC clock offset) with `sync.tolerance` 40 ms (≈ one frame at 25 fps); a feed outside tolerance is re-synced by cross-correlating its audio with the host mix before compile.
- **What the take captures.** `Take.turns[{speaker, fromMs, toMs, source}]`, `Take.tracks` per speaker (face, eyes, hands, yaw), `Take.overlays` and `Take.steps` as before, `Take.manual[{atMs, action: floor → speaker}]`.
- **Studio / Play / Loop / publish.** Studio: rings and switches from live VAD with hysteresis; Play/Loop: turn events from the plan's authored `speaker` per step (one switch per step at most), loop seam returns to the equal family; publish: `Take.turns` after diarization, quantised to fps, with the hysteresis applied at compile so the resolved stage timeline is deterministic.

---

## 25. Data model, compositing, tokens, ownership, validation, build plan

### 25.1 Schema additions (additive to `incredible-studio/slide-motion/v2`)

```json
{
  "$defs": {
    "Speaker": { "type": "object", "properties": {
      "id": { "$ref": "#/$defs/Id" }, "name": { "type": "string" },
      "role": { "enum": ["host", "guest"] },
      "source": { "enum": ["shared-camera", "local", "remote", "audio-only"] },
      "feedId": { "type": "string" }, "colour": { "type": "string", "description": "theme key" },
      "faceCenter": { "$ref": "#/$defs/Point", "readOnly": true } }, "required": ["id", "role", "source"] },
    "LayoutFamily": { "enum": ["speaker-full", "speaker-panel", "split", "content-pip", "content-card", "content-cutout", "ots-box", "takeover", "gesture", "speaker-card-board",
                                 "dual-box", "dual-wide", "host-guest", "dominant", "trio-row", "content-multi", "split-duo"] },
    "Tile": { "type": "object", "properties": { "speaker": { "$ref": "#/$defs/Id" }, "rect": { "$ref": "#/$defs/FRect", "x-tier": "advanced" }, "treatment": { "$ref": "#/$defs/SpeakerTreatment" }, "active": { "type": "boolean", "readOnly": true } }, "required": ["speaker"] },
    "TurnPolicy": { "type": "object", "properties": {
      "source": { "enum": ["auto", "manual", "diarization", "vad"], "default": "auto" },
      "dominant": { "type": "boolean", "default": true, "description": "allow the dominant family on long turns" },
      "overlap": { "enum": ["equalize", "keep"], "default": "equalize" } } },
    "StageLayout": { "type": "object", "properties": {
      "family": { "$ref": "#/$defs/LayoutFamily" }, "speaker": { "$ref": "#/$defs/SpeakerFrame" },
      "tiles": { "type": "array", "items": { "$ref": "#/$defs/Tile" }, "maxItems": 3, "description": "order = display order; host first by default" },
      "content": { "$ref": "#/$defs/FRect" }, "slots": { "type": "array", "items": { "$ref": "#/$defs/OverlaySlot" } } }, "required": ["family"] },
    "Stage": { "type": "object", "properties": {
      "aspect": { "enum": ["16:9", "9:16", "1:1"] }, "base": { "$ref": "#/$defs/StageLayout" }, "timeline": { "type": "array", "items": { "$ref": "#/$defs/StageEvent" } },
      "speakers": { "type": "array", "items": { "$ref": "#/$defs/Speaker" }, "maxItems": 3 },
      "nextOwner": { "$ref": "#/$defs/Id" }, "turnPolicy": { "$ref": "#/$defs/TurnPolicy" } }, "required": ["base"] }
  }
}
```

`OverlaySlot` gains `speaker` (attribution: anchors the slot to that speaker's tile) and the slot kinds `namePill` and `sharedCard`. `Step.narration` gains `speaker`. `Take` gains `turns[]`, `manual[]`, per-speaker `tracks`, and `media[]` with `offsetMs`. `StageEvent.transition.kind` gains `join`, `leave`. A block with one speaker and no `speakers[]` compiles exactly as Part II; a single-speaker `speakers[]` entry is equivalent to Part II's `SpeakerFrame`.

### 25.2 Compositing and the driver
- **N camera layers**, one per feed, each a frame-space unit with its own `clip`, crop transform, ring and treatment; the stack of §14.1 gains layer 3a…3c (cameras) below the content layer; z-order within the camera layers changes only during a dominant switch (growing tile on top).
- **One `stage(k,t)`** returns per-tile rects, crops, ring alphas and slot rects; turn events are part of the resolved stage timeline (publish) or applied live with the same hysteresis code (studio).
- **Matte canvas** per cut-out speaker; the rehearsal gate multiplies, so `cutout.maxSpeakers` 1: at most one cut-out speaker at a time, the others are tiles.
- **Audio**: a mixed program track plus per-speaker tracks recorded separately (they feed diarization and VAD); the L-cut rule holds: nothing about a layout change touches audio.
- **Determinism**: publish never runs VAD or diarization at render time; it reads `Take.turns`. The studio's live VAD is the only per-frame external input and never writes plan state.

### 25.3 Tokens for several speakers

| Token | Value | Source |
|---|---|---|
| `tile.dual` | (0.05, 0.10, 0.36, 0.73) × 2, `gap.dual` 0.18 W (the shared column) | interview practice; derived from safe areas, the caption band and `gap.freeMin` |
| `tile.trio` | 0.29 W × 0.62 H × 3 at y 0.12, `gap.trio` 0.025 W | panel practice |
| `dominant.active / dominant.rest` | (0.04, 0.06, 0.62, 0.77) / 0.26 W × 0.32 H column at x 0.70, gap 0.03 H | conferencing "speaker view" |
| `hostGuest.host / hostGuest.guest / hostGuest.slot` | 0.56 W column / (0.60, 0.20, 0.35, 0.47) / (0.60, 0.70, 0.35, 0.13) | Part II speaker-panel |
| `chips.multi` | Ø 0.14 W (two) / 0.12 W (three) at x 0.80, gap 0.03 H | Part II chip |
| `splitDuo.content / splitDuo.tiles` | (0.02, 0.08, 0.50, 0.75) / (0.55, 0.06, 0.41, 0.37) + (0.55, 0.46, 0.41, 0.37) | ours |
| `dualStack / trioStack` | (0.05, 0.09, 0.90, 0.34) + (0.05, 0.44, 0.90, 0.34) / 0.22 H at y 0.09, 0.32, 0.55 | 9:16 reservations |
| `eye.alignTol` | 0.02 H | portrait framing |
| `gap.freeMin` | 0.18 W | ours |
| `turn.minMs / turn.interjectionMs / turn.overlapMs` | 1200 / 700 / 1500 | conferencing practice; broadcast directing |
| `turn.dominantAfter / turn.pingPongTurns / turn.pingPongWindow` | 12000 / 3 / 10000 | TV directing |
| `dur.tileSwap / dur.tileRespace` | 500 / 450 (`ease.camera`, never scaled) | Part II reframes |
| `active.ring` | 2 px @1080, alpha 0.9, speaker colour (theme) | conferencing |
| `rest.saturate` | 0.85 (dominant and trio-row rest tiles only; never opacity) | ours |
| `namePill.h / namePill.pad` | 0.028 H / 0.008 H | broadcast nameplates |
| `identity.holdMulti / identity.recallAfter` | 4–5 s / 90 s | newsroom practice |
| `sharedCard` | ≤ 0.16 W × 0.30 H, top on the aligned eye row, in the centre column | ours |
| `caption.speakerLabel` | on when ≥ 2 speakers; label until seen twice, then colour only | accessibility practice |
| `punchIn.maxCrop / punchIn.minDwell` | 0.5 W of the source (zoom ≤ ×2) / 4000 | camera practice |
| `cutout.maxSpeakers` | 1 | frame budget |
| `value.overlapDelayMax` | 1000 | ours |
| `sync.tolerance / sync.beacon` | 40 ms / clap or tone at take start | post practice |
| `avatar.ring` | waveform ring on audio-only tiles (required) | conferencing |

**Taste rules without a number.** One conversation, one frame. Equal by default, dominant by exception. Never dim a face. Names before claims. Align the eyes. The gap is the open side. Interjections do not move the camera. When two talk at once, show both. One size change per turn. A join or a leave is punctuation, never simultaneous with a switch.

### 25.4 Ownership

| Decision | Rule | Author | LLM |
|---|---|---|---|
| Speaker roster, roles, sources, display order | — | ✓ | never |
| Base family for N speakers | §19.1 | ✓ layout picker | proposes only on a cue phrase ("let me show you both", "back to the two of us") |
| Turn policy (source, dominant allowed, overlap mode) | defaults | ✓ | never |
| Who owns Next | host | ✓ | never |
| Speaker attribution of sentences | diarization | ✓ corrects | ✓ from transcript labels (`speaker` per sentence) |
| Attributed vs shared overlay | default by content | ✓ | may propose attribution ("as Ana said") |
| Hysteresis, geometry, alignment, ring, pills, sync | ✓ always | advanced only | never |

**Planner (§6.3, §16 extended).** Inputs add the roster and per-sentence speaker labels; output adds `narration.speaker` per step, optional `slot.speaker` for attribution, and stage cues gated as in §16. Errors: an attributed overlay to a speaker not in the roster; a claim attributed before that speaker was named; a layout cue with no intent change. Warnings: > 1 attributed overlay per beat; a shared count stated by two speakers.

### 25.5 Validator (L10, stage classes extended)
Errors: overlay across two tiles that is not a shared band; a pill or strap over another tile; an unlabelled caption with ≥ 2 speakers; an audio-only tile without the waveform ring; two identity straps at once; a hero under any tile. Warnings: eye rows misaligned > `eye.alignTol`; parity broken (equal family with different crop tiers); a switch on an interjection; ping-pong not equalised; a join coinciding with a switch; face unseen > 2 s in a tile; feed sync outside tolerance; more than one cut-out speaker requested. Review frames: every switch, join and leave ± 0.5 s, plus the first strap of each speaker.

### 25.6 Worked examples

**(a) Interview, dual-box, a shared figure counted on the host's word.** Roster: host Ana (local), guest Ben (remote). Base `dual-box`; straps once (Ana at +0.6 s, Ben when he first speaks); pills after. Sentence 5 (Ana): "…we cut it from three hundred to forty milliseconds." → `sharedCard` in the centre column (x 0.41–0.59, exactly `gap.freeMin` 0.18 W, candidate 1), its top on the aligned eye row at 0.377 H, with `count 300 → 40` landing on "forty" from Ana's onsets; Ben's tile keeps its pill; the ring is on Ana.

**(b) A long guest turn → dominant, with an attributed quote.** Ben speaks 14 s uninterrupted → after 12 s the stage event materialises `dominant` with Ben active (500 ms, one t for both tiles, Ana shrinks 80 ms later into the rest column); his quote "the cache was the whole story" enters as a `pinnedCallout` anchored to his tile's near corner on his cue word, in his colour; Ana's interjection "right" (400 ms) flickers her ring and nothing moves; when Ana takes the floor for 1.5 s the layout returns to `dual-box` (not to `dominant` on Ana: her turn is shorter than 12 s).

**(c) Three speakers over a diagram.** `trio-row` base; the beat names four units of an architecture diagram → `content-multi` with three chips Ø 0.12 W at x 0.80 in roster order; the trace and pulse are Part I operations on the page; the ring moves between chips with the turns, chips never resize; captions carry labels; the host owns Next.

**(d) 9:16 dual-stack.** Same roster as (a); tiles stacked, eyes at 0.38 of each tile, captions over the lower chest labelled "ANA:" / "BEN:"; the shared figure becomes a `topBand` count above the upper tile; no reframes.

### 25.7 Build plan addendum (phases 16–19)

| Phase | Deliverable | Files | Notes |
|---|---|---|---|
| 16 | **Speakers model and multi-feed capture.** `Stage.speakers`, `Tile`, the seven families and restacks, N camera layers with per-tile clip/crop, `getUserMedia` for several devices and a WebRTC/recorded ingest path, per-speaker mic tracks, the sync beacon and `offsetMs` | `types.ts`, `presenter-layouts.ts` (family table), `index.ts`, `slide.ts` (`stage(k,t)` per tile), `apps/studio-v2/src/main.ts` (capture) | renders Part II blocks identically; a one-speaker roster equals `SpeakerFrame` |
| 17 | **Turns.** Live VAD per mic with hysteresis, the ring and `rest.saturate`, dominant switches and tile swaps, joins and leaves, the host's floor hotkey, coach per speaker | `main.ts`, `slide.ts`, `index.ts` | studio only until 18 |
| 18 | **Publish with several voices.** Offline diarization → `Take.turns`, per-speaker tracks, per-sentence `speaker`, attributed overlays and shared cards, name pills and multi-speaker straps, labelled captions, avatar tiles, cross-correlation re-sync | `server/index.ts` (diarization job), `slide.ts`, `index.ts`, `main.ts` | needs Part II phase 14 (tracks) |
| 19 | **Planner, validator, review.** Roster and speaker labels in the prompt, attribution rules, L10 multi-speaker classes, review frames at switches/joins/leaves, reduced-motion switches as crossfades | `server/index.ts`, `motion-validate.ts`, `main.ts` | errors block present/publish, never save |

Dependencies: 16 needs Part II phase 11 (stage model) and 13 (capture path); 17 needs 16; 18 needs 14 and 17; 19 closes with phase 15.

---

