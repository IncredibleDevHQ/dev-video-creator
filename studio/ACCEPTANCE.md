# Rebuild acceptance — 1 October 2026

The supplied HTML handoff and subsequent user instructions define completion.
Passing fixture tests is not proof of model quality, device behavior or visual
acceptance. The rebuild remains in progress; the old app has not been retired.

## Requirements and evidence

| Requirement | Current evidence | Status / next proof |
| --- | --- | --- |
| M0: standalone layout, copied tests, two-command fresh clone | `app`, `engine`, `render`, `desktop`, `shared`, `checks`; own lockfile; outside-parent install/doctor run recorded in historical notes | Partial: system tools came from the existing machine. Clean-machine provisioning is unproven. |
| M1: real blog → rich deck, progressive slides, editing/chat/PDF | Actual Kimi K3 Canvas notebook has nine rich SVG slides. Isolated pipeline, editor and PDF checks exist. | Partial: one actual Claude source-chat reply with four validated source passages is now proven; real slide-edit quality and complete prototype visual acceptance remain unverified. |
| M2: plan every scene, camera policies, transcript, states | Canvas notebook has nine planned and produced scenes. Scoped moment IDs, camera windows and fixed activity-state checks pass. | Partial: native settings preview now verifies inherited scenes and custom overrides; some live processing details still need visual review. |
| M3: practice, record one/all, review/retake, preserve matching takes | Mocked capture lifecycle plus real synthetic media normalization, composition and trim checks; earlier native setup/cancel/retake dialog inspection | Partial: physical camera/mic permission denial, actual one/pass capture, review, retake and save need device-level verification. |
| M4: scene downloads, transitions, joined MP4 matches UI | Actual Canvas export: nine scenes, 382.388667s, 1920×1080 H.264/AAC. UI export download matches persisted bytes; full file decoded. Earlier UI playback crossed scene boundaries. | Partial: comprehensive visual/transitions acceptance and current recovery UI review remain pending. |
| M5: consented clone, sample/deletion, cloned voice title/end video | Clone lifecycle protocol tests; actual render fixtures for branding/title/name overlays | Partial: real provider clone, sample quality, deletion and cloned-voice video remain unverified. Requires authorized voice material/provider access. |
| M6: both stores, split large copied files, docs, clean-machine flow, old app retired | 276 tests; TypeScript/build; real disposable PostgreSQL/MinIO three-worker recovery. Latest remote run includes animation, measured audio composition, joins/covers, take trims, lineage and corruption checks. | Incomplete: full real-model remote flow, clean-machine run, final visual/device/clone gates and retirement remain. |
| Notebook-scoped artifacts and S3 portability | Indexed checksummed immutable artifacts, configurable endpoint/bucket/region/credentials, SDK credential-chain MinIO check | Machinery proven on MinIO; AWS deployment has not been exercised. |
| One composition pass, independent animation and recording | Animation checkpoints use design inputs; finishing/retakes reuse them. Unit and remote composition checks. | Implemented. Actual Canvas scenes 5–9 use the new path; older scenes 1–4 are retained legacy outputs. Do not regenerate them solely to migrate. |
| Bounded usage and transparent waiting | Bounded harness stages, explicit interrupted-run retry, deduplication, token reporting, shared event worker, bounded SSE leases, fixed activity frontier | Implemented with regression coverage; live progress details and recovery visuals need current native verification. |
| Prototype camera/settings/moment design | Scene hover gear, global setting preview, three presence modes, camera cues, spaced moment cards and frame-based playhead | Implemented; full visual acceptance is not established by DOM tests. |
| Take trimming without regeneration | Real media trim test checks clock, original retention and zero model calls. Three-worker remote trim/lineage/decode check passed. | Explicit time-range command proven; arbitrary natural-language trim interpretation is not supported. |
| Commits attributed to Karthic Rao | Recent commit author and committer are `Karthic Rao <kartronics85@gmail.com>` | Proven for recent commits; no push requested. |

## Reproducible evidence

- `yarn run check`: 72 test files, 276 tests passed on 1 October 2026.
- Startup preflight is tested with missing tools in an isolated temporary path;
  the engine refuses startup without creating notebook data. This does not prove
  clean-machine provisioning.
- `yarn run build`: TypeScript and Vite production build passed.
- Saved-player seeks wait for metadata, use the latest requested moment, and
  clamp to measured duration. Protocol tests pass; native confirmation of the
  intermittent blank-player recovery remains open because browser control timed out.
- Voice training stops starting new polls after a ten-minute attempt window.
  An already running request can finish within its existing request timeout.
  Tests verify expired attempts stop polling and explicit retry reuses the saved
  provider reference without another clone-creation POST. Real provider quality
  and native waiting/recovery presentation remain unverified.
- `yarn run check:storage`: disposable PostgreSQL/MinIO passed in 10.13s,
  including editing a remote take in worker two and decoding it in worker three.
- Actual Canvas notebook: `cc4f18d0-688c-40f4-93ab-a4773bafdabc`, retained in
  an isolated local diagnostic store. These are actual model outputs, not the
  synthetic storage fixture.
- Downloaded `~/Downloads/video.mp4` SHA-256:
  `40c6ca726f9fa797c75cb42efb0b881edc18f7bfc21b532518ada773c2a9f014`.
  It is 31,158,136 bytes. It uses the nine actual retained scenes.
- Native review in a fresh in-app tab verified Scene 3 displays and plays its
  saved content/avatar layout (`readyState=4`, no media error, advancing to
  11.43s and moment 2). Completed activity, camera cues and scene hover gear
  are visible. Global settings preview correctly lists inherited scenes
  1, 2, 5, 6, 7, 8, 9 and preserves two custom overrides; it was cancelled
  without applying changes. Screenshots are `/tmp/studio-scene-three-native-current.png`
  and `/tmp/studio-settings-preview-verified.png`. Browser control remains
  intermittent, and the new immediate settings-loading state still needs review.

Actual source-chat evidence: `checks/source-chat.live.mjs` ran once against an
isolated copy of the retained Canvas article with Claude Code
`claude-opus-5-5`. The run completed with one accepted reply and four validated
verbatim evidence passages, retaining the question/reply and leaving slides/video
unchanged. Its proof is in the isolated diagnostic’s `source-chat-proof.json`.
The route has a 120-second wall limit, 45-second inactivity limit and 20-tool-call
cap. This is one grounded answer, not slide-edit or full milestone acceptance.

## Remaining acceptance work

1. Continue native review of opening/recovery/loading states, live/stalled
   activity, recording review, and the full prototype layout. Global settings
   preview and Scene 3 playback have current native evidence.
2. Verify physical camera/mic permission, one/open-pass capture, timed/manual stop,
   review, retake, save and final composition. The focused recording-error dialog
   has regression coverage but native visual verification remains pending. Obtain specific device authorization
   before accessing physical devices.
3. Verify the consented real voice clone flow and title/ending video with authorized
   material and configured provider access.
4. Exercise real-model edits and the complete remote notebook flow; inspect final
   output quality. Do not call synthetic fixtures model evidence.
5. Prove the clean-machine setup/flow, then perform the cutover and retire the old
   studio only after all preceding gates pass.
