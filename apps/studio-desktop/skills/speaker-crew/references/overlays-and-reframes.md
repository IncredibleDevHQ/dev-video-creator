# Overlays And Reframes

> Reference for the `speaker-crew` skill. Source: *The Motion Decision Core*, sections §22, §23. Read only when the routing table triggers it.

Straps once, pills always; attribution; shared information; captions; avatar tiles; dominant switches, punch-ins, joins and leaves.

## 22. Overlays with several people

### 22.1 Identity: straps once, pills always
Each speaker gets **one identity strap** when they first speak in a scene, `+0.5–1.0 s` after their speech starts, holding `identity.holdMulti` 4–5 s (shorter than the solo 5–7 s because two straps in sequence cost more time). Straps sit inside the speaker's own tile at the tile's lower third, justified toward the tile's outer edge, and **never two at once**: the second waits for the first to exit plus `gap.exitEnter`. After the straps, every tile carries a **name pill** (`namePill` slot: text 0.028 H on a solid pill at the tile's bottom-left, inside the tile's title-safe): a persistent chrome element that viewers need to follow who is speaking. A strap is recalled after `identity.recallAfter` 90 s of silence from that speaker or at a page change. In `dual-wide` (one camera) pills sit under each person's hard zone on the soft torso, staggered so they never collide; if the two people are closer than a pill width, one shared strap names both in speaking order.

### 22.2 Attribution
A claim, quote or figure said by one speaker is **attributed**: it enters on *that speaker's* cue word, anchored to their tile (a `pinnedCallout` whose anchor is the tile's near corner, or a `cornerCard` in the free region nearest that tile, with a 0.02 W colour tab in the speaker's colour). The leader never crosses any hard zone, including the other speakers'. An attributed overlay follows its tile through a reframe: it re-anchors `caption.reanchorDelay` 450 ms after the tile settles, and exits if the tile leaves.

### 22.3 Shared information
Topic straps, agenda, timers and figures that belong to the conversation use the free region: the centre gap (`sharedCard`: ≤ 0.16 W × 0.30 H, top on the aligned eye row) or the head band (`topBand`/`heroLine`). A shared count lands on the cue word of whoever states it. When a beat names a structure, the family switches to `content-multi` and the shared content becomes the page; the chips keep their order and the ring keeps the attribution.

### 22.4 Captions
With ≥ 2 speakers, captions carry a **speaker label** (`caption.speakerLabel`: "ANA:" in the speaker's colour, or the colour alone once the viewer has seen the label twice), one band shared by all; a change of speaker starts a new caption line even mid-sentence. In `dual-stack` (9:16) captions sit over the lowest tile's chest, labelled.

### 22.5 The audio-only guest
A guest without video gets an **avatar tile**: a still (initials or photo) inside the tile with a **waveform ring** driven by their VAD. This is the one declared exception to "a speaker is never a still": the ring supplies the life, and the validator requires it whenever `source: audio-only`. Avatar tiles never take the `dominant` active slot; a long audio-only turn keeps the equal family with the ring.

---

## 23. Reframes with several people

### 23.1 Equal ↔ dominant
The active tile grows **in place** toward its dominant rect while the others shrink into the rest column; clip and crop of every tile are written from **one progress value**, and face centres travel on straight lines. Duration `dur.tileSwap` 500 ms, `ease.camera`, never scaled by `durationScale`. Rings fade during the move and return at the end. Eye rows re-align at t = 1 (the crop adjustment is part of the move, not a second step).

### 23.2 Turn switch inside dominant
Two tiles change size at once: the **growing tile is on top**, its path and the shrinking tile's path **never cross** (the rest column is on one side, so paths are monotonic), and the shrinking tile starts `lag.pipShrinkDelay` 80 ms later. Attributed overlays on either tile re-anchor after the settle; a shared card in the free region stays. Reduced motion: the switch is a 150 ms crossfade.

### 23.3 Co-located punch-ins (`dual-wide`)
With one camera, the only reframe is a **source crop**: when the source has the resolution (crop ≥ `punchIn.maxCrop` 0.5 W of the source, i.e. zoom ≤ ×2), a long turn may punch in on the active speaker with lead room toward the other person, held ≥ `punchIn.minDwell` 4 s; the return to the two-shot happens on overlap or at the next turn. Punch-ins are `speaker-full` for that speaker: Part II slots apply, with the other speaker's hard zone still respected when it is partly in frame. When the source resolution is insufficient, there are no reframes: the two-shot is the whole page and emphasis is the ring on the name pill only.

### 23.4 Joins and leaves
A speaker joining or leaving is a **stage seam** (`stage.join`, `stage.leave`, L9 fields). On a join the existing tiles re-space over `dur.tileRespace` 450 ms and the new tile enters from its own edge by its own width `lag.panelAfterSpeaker` 150 ms after the re-spacing starts; its identity strap follows §22.1. On a leave the tile exits first, then the rest re-space. Joins and leaves count as layout events for the rhythm caps and never coincide with a turn switch (the switch is deferred).

---

