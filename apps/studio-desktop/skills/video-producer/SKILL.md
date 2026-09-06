---
name: video-producer
description: >
  Turns a take and a resolved plan into a frame-exact video: seek-driven frame
  rendering, captions with speaker labels, alpha overlays for external editors,
  review sheets at every reframe and seam, sync checks. Use when the user asks to
  export, publish, render, make the MP4, produce captions, or mentions
  video-producer. Requires motion-master's resolved plan; uses a reconciled take
  when one exists.
metadata:
  version: "0.1.0"
  source: "The Motion Decision Core §4.6, §12.3, §14.4, §22.4, §28.8"
---

# Video Producer

Routes: **Publish** (`workflows/publish.md`) · **Review** (`workflows/review.md`).

Hard rules: never export by real-time playback — every frame is `paint(step, t)` at a quantised time; the camera is the recorded raw track re-composited by `stage(k,t)`; alpha goes through the frame-exact renderer (PNG sequence → ProRes 4444 / VP9 yuva444p), never MediaRecorder; captions carry speaker labels when the roster has ≥ 2; sync tolerance 40 ms.
