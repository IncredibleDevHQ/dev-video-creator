# Stage Tokens

> Reference for the `stage-director` skill. Source: *The Motion Decision Core*, sections §15. Read only when the routing table triggers it.

Stage tokens and taste rules without a number.

## 15. Tokens for the stage

Motion and geometry only; static design (radii, shadows, colours, type sizes, ring alpha, hairlines, skin-band exclusion) lives in `themes.ts`. Fractions of W or H as marked; ms before `durationScale` except reframes.

| Token | Value | Source |
|---|---|---|
| `safe.action / safe.title` | 0.035 / 0.05 | SMPTE / EBU |
| `safe.vertical.top / bottom / right` | 0.09 / 0.22 / 0.13 | platform templates |
| `caption.band / caption.fontH / caption.maxChars / caption.minMs / caption.maxMs / caption.reanchorDelay` | y 0.85–0.95 H / 0.036 H / 42 / 1000 / 7000 / 450 | Netflix, BBC; talkcraft |
| `gap.gutter` | 0.02 W | broadcast |
| `chip.diameter S/M/L / chip.inset / chip.bottom` | 0.14 / 0.18 / 0.22 W; 0.042 W; 0.16 H (legacy 0.157) | talkcraft; today's presets |
| `pip.tile` | ≥ 0.26 W × 16:9 (0.20 W head-only) | broadcast |
| `panel.speakerW / panel.tallSpeakerW` | 0.56 (≈1:1) / 0.42 (3:4) | broadcast |
| `card.w` | 0.245 / 0.31 W | today's presets |
| `ots.box` | 0.36 W × 16:9 at x 0.57, y 0.10 | news OTS |
| `lowerThird.rect / chinGap / refreshWindow` | x 0.05–0.60, y 0.72–0.84 / 0.05 H / 2000 | broadcast |
| `cutout.height / footprint / pad / minMatte` | 0.55–0.70 H / ≤ 0.30 W / 0.04–0.06 W / 0.8 (per-beat rolling minimum) | mmhmm practice |
| `behind.minOcclusion / behind.rise / behind.minDeltaL` | 0.25 of title height / 0.037 H / 0.30 luminance vs the torso p50 | talkcraft behind-text-title |
| `reach.y / reach.x` | shoulder ± 0.25 H / 0.35 W | weather presenting |
| `nogo.faceScale.w / h / nogo.margin / nogo.hands` | 1.5 / 2.0 / 0.05 W / 0.03 W | broadcast; talkcraft |
| `face.canonical / face.holdMs` | centre (side third, 0.44 H), w 0.14 W, eyes 0.38 H / 2000 | portrait framing |
| `crop.eyeLine / headroom / deadZone / maxVel / followMs` | 0.38 of crop H / 0.08–0.12 / 0.03 W / 0.02 W/s / 400 | portrait framing |
| `gaze.yawSide / yawCue / window` | 10° / 20° / 300 | gaze cueing |
| `scrim.flat / gradient / top / edgeW / escalate / max` | 0.4–0.6 / 0→0.7 over 0.30 H / 0.35→0 at 0.45 H / 0.35 W / +0.1 / 0.75 | broadcast; talkcraft |
| `glass.blur / glass.tint / glass.maxPanels` | 16–24 px / 0.35–0.5 / 1 | Apple material practice |
| `bed.brightness / saturate / blur / foregroundDrop` | 0.35–0.50 / 0.5–0.7 / ≥ 20 px / 0.28 in 400 ms | talkcraft |
| `legib.contrastBody / contrastLarge / energyLow / energyHigh / text.largeH / text.minOverVideo / text.silhouetteGap` | 4.5:1 / 3:1 / 0.02 / 0.06 / 0.033 H / 0.022 H / 0.03 W | WCAG; ours |
| `plate.cover` | ≥ 0.9 | talkcraft |
| `dur.reframeOut / reframeIn / reframeSplit / pipSwap` | 450 / 600 / 500 / 500, `ease.camera`, never scaled | broadcast; talkcraft 0.42 s |
| `dur.lowerThirdIn / lowerThirdOut / panelIn / panelOut` | 300 / 250 / 450 / 300 | broadcast |
| `lag.panelAfterSpeaker / returnAfterGraphic / pipShrinkDelay` | 150 / 120 / 80 | talkcraft |
| `ant.placeLead / ant.reframeLead` | 300 (200–400) / 400 (300–500) | broadcast |
| `hold.identity / hold.number` | 5–7 s / 2 s (floors on hold(k)) | newsroom practice |
| `gap.overlayClear / seam.tailGuard / lint.landing` | 300 / 500–700 / ± 100 | talkcraft beat lint |
| `budget.overlays / overlayRate / keywordPops / layoutEventsPerMin` | 2 / 1 per 3 s / 3 per deck / 2–4 | broadcast; talkcraft |
| `layout.minDwell / maxChangesPerBeat / abaWindow / sideFlipsPerPage / returnCutAfter / hookSeconds / cut.minSpacing` | 4000 / 1 / 10 s / 1 / 8 s / ~8 s / 1000 | TV directing; talkcraft |
| `gesture.reach / dwell / maxAdvance / trigger.raiseMs` | 0.04 W / 250 / one sentence / 400 | weather presenting |
| `anchor.dampMs / hysteresisMs / leaderMax / candidates / offFrameHold` | 100 / 300 / 0.15 W / 8 / 1000 | telestrator practice |
| `preview.addedLatencyMs / capture.edgeInset / capture.fpsMultiple` | 70 / 0.032 W / integer | ours; talkcraft |
| Reduced motion (stage) | reframes → cuts or ≤ 150 ms crossfade; PiP move → cut; overlays fade only; ticker pages every 6 s; callouts pin once; follow-crop off | WCAG / HIG |
| Comfort (stage) | ≤ 20 % luminance change per hard cut, else 150 ms crossfade; flash limits are the core's tokens | ours |

**Taste rules without a number.** The person is present or deliberately covered, never quietly gone. The speaker is video, never a still. The chip never drifts or breathes; when it must move it moves once. Information enters away from the speaker and lands on the eye row. A switch is punctuation, not a metronome. Open on the person, close on the person. Nothing over the face, nothing over the hands, nothing thin over video. Plates are neutral. Cover, shrink or slide — never a translucent overlay fighting a face. Glass beside a person, never on one. Move the text before thickening the plate. A reframe keeps the eye row. The camera supplies the life; nothing else breathes.

---

