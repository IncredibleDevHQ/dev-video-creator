# Zones And Turns

> Reference for the `speaker-crew` skill. Source: *The Motion Decision Core*, sections §20, §21. Read only when the routing table triggers it.

Zones per speaker, eye alignment, the free region; the active-speaker signal and hysteresis.

## 20. Zones, eye alignment and the free region

### 20.1 Zones per speaker
Each speaker carries a hard face zone, a soft torso zone and a hands zone exactly as §8.4, computed in **frame space** (tile rect × tile crop → frame). In `dual-wide` the two hard zones are computed from two face boxes on one feed; the larger face is the near speaker, both are speakers (the Part II "two faces → larger is the speaker" rule is replaced by the speaker roster). Face lost in a tile > `face.holdMs` 2 s → that tile's zones freeze, then fall back to the tile's canonical presenter; the roster never shrinks.

### 20.2 Eye alignment
Tiles of the same tier align their eye rows on one horizontal within `eye.alignTol` 0.02 H. The rule adjusts each tile's **crop** (never its rect) so eyes land at 0.38 of the tile; a speaker who sits low in their own camera is cropped tighter, one who sits high gets more headroom, up to the headroom limit (8–12 % of the crop). If alignment cannot be reached within the source's resolution, the validator warns and the coach tells that speaker to re-seat ("sit a little higher"). Different tiers (`dominant` active vs rest, `host-guest`) are exempt from cross-tier alignment but the tiles inside a tier still align.

### 20.3 The free region (the open side, generalised)
With several faces, "the open side" becomes the **free region**: title-safe minus the union of all hard zones, minus the caption band, minus persistent slots (pills, bug). Candidates, in order:

1. the **centre gap** between the two nearest hard zones when it is ≥ `gap.freeMin` 0.18 W (shared figures, a shared card, a "vs" chip);
2. the **head band** above all heads when it is ≥ 0.20 H clear (top band, hero line);
3. the **outer side** with the most free width (a corner card);
4. the **lower third across both** (a shared strap; never over a tile's own strap).

Information that **belongs to one speaker** (identity strap, an attributed quote, a callout on what they hold) is anchored to that speaker's tile or hard-zone edge and never uses the centre gap. Information that **belongs to the conversation** (topic, figure, agenda, timer) uses the free region or, when it is a structure, the family switches to `content-multi`.

---

## 21. Turn-taking: the active-speaker signal

The active speaker is a **stage input** like the matte: it drives emphasis and layout but is never plan state, and publish reads it from the take so `stage(k,t)` stays pure.

| Source | Studio | Publish | Precedence |
|---|---|---|---|
| manual | host hotkey / pedal ("hand the floor"), or the planner's `speaker` attribution when a step is authored to a speaker | recorded manual events | 1 |
| diarization | — | offline (WhisperX/pyannote-class) → `Take.turns` | 2 |
| VAD per mic | energy VAD on each local mic track; remote feeds report speaking flags | fallback when diarization is unavailable | 3 |

**Hysteresis (rule, §25.3).** A new speaker becomes active only after `turn.minMs` 1200 ms of continuous speech; speech shorter than `turn.interjectionMs` 700 ms is an **interjection**: the ring flickers on the interjector's tile for its duration and nothing else moves. Overlap longer than `turn.overlapMs` 1500 ms switches to the **equal** family (`dual-box` / `trio-row`) with rings on all who speak; when overlap ends, the next clear turn re-evaluates. A `dominant` switch requires the speaker to have held the floor for `turn.dominantAfter` 12 s (the first switch) and `layout.minDwell` 4 s since the last change (subsequent switches). Ping-pong (≥ 3 turns in 10 s) pins the equal family until the window is clear.

**Emphasis levers for people.** In order of preference: the **ring** (`active.ring`, theme: 2 px @1080, alpha 0.9, speaker colour or accent), then **tile size** (dominant), then `rest.saturate` 0.85 on rest tiles in `dominant`/`trio-row` only. Never opacity, blur, scale pulses or a vignette on a face. In `content-multi` the ring is the only lever (chips never resize); in `dual-wide` the lever is the punch-in (§23.3) or nothing.

**Coach.** Each speaker's self-view shows their own ring state and a "floor" indicator; the host's coach shows the turn timeline and a "hand the floor" cue. Guests never see other guests' cues.

---

