---
name: speaker-crew
description: >
  Profile for two to four speakers on camera together — co-located on one camera
  or on separate feeds: tile families, eye alignment, the free region, turn-taking
  with hysteresis, names and attribution, shared content with chips, joins and
  leaves, one-camera punch-ins, clocks and sync, labelled captions, avatar tiles,
  the collaboration patterns for two people explaining together, and the gallery
  rules for four. Loaded by motion-master and stage-director when the roster has
  ≥ 2 speakers; use directly when the user asks about interviews, panels, co-hosts,
  several speakers, or mentions speaker-crew.
metadata:
  version: "0.1.0"
  source: "The Motion Decision Core, Part III (§18–§26, §29)"
---

# Speaker Crew (profile)

Not a route: a profile loaded inside Plan Motion / Plan Stage. Invariants added to Parts I–II: one conversation, one frame (equal by default, dominant by exception); names before claims; every speaker is chrome.

| Trigger | Load |
|---|---|
| roster ≥ 2 | `references/scope-and-families.md`, `references/zones-and-turns.md`, `references/overlays-and-reframes.md`, `references/clocks-and-model.md` |
| two people building information together | `references/collaboration.md` |
| roster = 4 | `references/four-speakers.md` |
