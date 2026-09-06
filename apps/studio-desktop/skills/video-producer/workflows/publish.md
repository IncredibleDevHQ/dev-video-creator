# Publish

🚧 GATE: `motion/resolved.json` (take-bound when a take exists) and the validator's final report with 0 errors.

1. Choose the clock: recorded take > word onsets > formula; quantise step offsets and windows to project fps.
2. Render frames: for each frame index, `paint(step, t)` and `stage(k, t)` in a hidden Chromium window; capture; overlays optionally as a separate alpha pass via `?step=&t=&static=1`.
3. Composite the raw camera track(s) per the stage snapshot (clip, crop, ring, treatment; matte offline when a cut-out was allowed).
4. Captions: from the transcript with onsets; speaker labels in the speaker's colour when ≥ 2; band 0.85–0.95 H (over the lower chest on 9:16).
5. Encode with ffmpeg; write `exports/<name>.mp4`, `captions.srt`, optional alpha overlay file; write `validation/<name>.report.json` (frames rendered, seek diff = 0 check, sync offsets, comfort rule checks).
6. Refuse to publish without the final validator report; never `cat` the full report on success — read the postflight summary.
