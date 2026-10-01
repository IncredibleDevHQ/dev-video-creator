# Rebuild acceptance — 1 October 2026

The supplied HTML handoff and subsequent user instructions define completion.
Passing fixture tests is not proof of model quality, device behavior or visual
acceptance. The rebuild remains in progress; the old app has not been retired.

## Requirements and evidence

| Requirement | Current evidence | Status / next proof |
| --- | --- | --- |
| M0: standalone layout, copied tests, two-command fresh clone | `app`, `engine`, `render`, `desktop`, `shared`, `checks`; own lockfile; outside-parent install/doctor run recorded in historical notes | Partial: committed studio installs/tests/builds in a fresh Linux container without host dependencies. Signed-in harness setup and complete clean-machine product flow remain unproven. |
| M1: real blog → rich deck, progressive slides, editing/chat/PDF | Actual Kimi K3 Canvas notebook has nine rich SVG slides. Isolated pipeline, editor and PDF checks exist. | Partial: one actual Claude source-chat reply with four validated source passages is now proven; one actual Claude slide revision/redraw now passes artifact validation and retains the other eight slides; editorial/visual acceptance remains incomplete. |
| M2: plan every scene, camera policies, transcript, states | Canvas notebook has nine planned and produced scenes. Scoped moment IDs, camera windows and fixed activity-state checks pass. | Partial: native settings preview now verifies inherited scenes and custom overrides; some live processing details still need visual review. |
| M3: practice, record one/all, review/retake, preserve matching takes | Mocked capture lifecycle plus real synthetic media normalization, composition and trim checks; earlier native setup/cancel/retake dialog inspection | Partial: the user physically captured Scene 3 moment 1; its 28.466-second take was saved through the UI and verified in the persisted notebook. Open-pass capture, permission denial, retake and final composition still need device-level verification. |
| M4: scene downloads, transitions, joined MP4 matches UI | Actual Canvas export: nine scenes, 382.388667s, 1920×1080 H.264/AAC. UI export download matches persisted bytes; full file decoded. Earlier UI playback crossed scene boundaries. | Partial: comprehensive visual/transitions acceptance and current recovery UI review remain pending. |
| M5: consented clone, sample/deletion, cloned voice title/end video | Clone lifecycle protocol tests; actual render fixtures for branding/title/name overlays | Partial: real provider clone, sample quality, deletion and cloned-voice video remain unverified. Requires authorized voice material/provider access. |
| M6: both stores, split large copied files, docs, clean-machine flow, old app retired | 295 tests; TypeScript/build; real disposable PostgreSQL/MinIO three-worker recovery. Latest remote run includes animation, measured audio composition, joins/covers, take trims, lineage and corruption checks. | Incomplete: full real-model remote flow, clean-machine run, final visual/device/clone gates and retirement remain. |
| Notebook-scoped artifacts and S3 portability | Indexed checksummed immutable artifacts, configurable endpoint/bucket/region/credentials, SDK credential-chain MinIO check | Machinery proven on MinIO; AWS deployment has not been exercised. |
| One composition pass, independent animation and recording | Animation checkpoints use design inputs; finishing/retakes reuse them. Unit and remote composition checks. | Implemented. Actual Canvas scenes 5–9 use the new path; older scenes 1–4 are retained legacy outputs. Do not regenerate them solely to migrate. |
| Bounded usage and transparent waiting | Bounded harness stages, explicit interrupted-run retry, deduplication, token reporting, shared event worker, bounded SSE leases, fixed activity frontier | Implemented with regression coverage; live progress details and recovery visuals need current native verification. |
| Prototype camera/settings/moment design | Scene hover gear, global setting preview, three presence modes, camera cues, spaced moment cards and frame-based playhead | Implemented; full visual acceptance is not established by DOM tests. |
| Take trimming without regeneration | Real media trim test checks clock, original retention and zero model calls. Three-worker remote trim/lineage/decode check passed. | Explicit time-range command proven; arbitrary natural-language trim interpretation is not supported. |
| Commits attributed to Karthic Rao | Recent commit author and committer are `Karthic Rao <kartronics85@gmail.com>` | Proven for recent commits; no push requested. |

## Reproducible evidence

- `yarn run check`: 78 test files, 295 tests passed on 1 October 2026.
- Startup preflight is tested with missing tools in an isolated temporary path;
  the engine refuses startup without creating notebook data. This does not prove
  clean-machine provisioning.
- `yarn run build`: TypeScript and Vite production build passed.
- Fresh Linux/arm64 container (Node 22.23.2), committed source `9dcd141`:
  locked install, 272 tests passed with four native macOS voice tests skipped,
  and production build passed. Real beside-slide, corner and full-screen
  presenter compositor fixtures ran. No host volumes, keys or notebook data
  were mounted. Distro Chromium uses `PUPPETEER_EXECUTABLE_PATH`; prerequisites
  came from Debian packages. Signed-in harness/device/voice flow remains unproven.
  Reproducer: `node checks/standalone-check.mjs`; committed source, twenty-minute
  limit. The initial missing-browser/OS-voice run failed and is not acceptance.
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

Actual slide-edit evidence: `checks/slide-edit.live.mjs` ran once on an isolated
copy of the retained Canvas deck with Claude Opus 5.5. Story Master accepted
“Where chat reaches its limits” with three exact article passages; Page Master
accepted the SVG/program through the pinned checker. The other eight slides
were byte-for-byte unchanged, and no video was generated. Proof, SVG and a
rendered PNG are in `/var/folders/qs/c7jp5csj6vx6wpmn3qylx7bh0000gn/T/studio-slide-edit-live-tRTgmi`.
The diagram contains illustrative chat examples requiring editorial review;
accepted source passages do not establish every diagram label as an article fact.
Revision is capped at 120s/45s inactivity/20 tools; redraw at 240s/90s/40 tools.
A regression test verifies redraw failure propagates without an automatic retry.

Presenter recording setup was opened natively for the user on Scene 3, moment 1,
“Canvas opens beside the chat”, with dialogue, optional stop time and countdown
guidance visible. Screenshot: `/tmp/studio-presenter-recording-ready.png`. The
user explicitly requested recording on camera, then recorded and stopped. At their
request the take was saved through the UI: take `7818ca06-81b6-4a8a-82f5-c564f39a5c78`,
measured duration 28.466s. The persisted notebook now requires final production
again. Review preserves content/presenter layers and hides the scene playhead
during capture/review; template regression tests pass, but the updated review
still requires a new native recording to verify visually. Permission waits now expire after sixty seconds; cancellation
settles immediately and late grants release tracks. Protocol tests cover both
paths. This does not substitute for native device verification.

Shared-worker heartbeat now re-registers its notebook watch. A lifecycle test
expires a subscription after sleep without a visibility event, verifies that
the heartbeat reconnects once, and that later heartbeats do not duplicate
connections. This is protocol evidence, not a completed sleep/wake device test.

Saved recording handoff now remains visible from persisted scene events until
completion. Returning to an unfinished camera moment uses its matching saved
take in the planned presenter region instead of the stand-in; stale takes are
excluded. Regression coverage checks the content remains visible and the
saved media element is retained during surrounding view updates. Native visual
verification of this latest change remains pending due to browser-control timeouts.

After a saved retake, the activity rail now ends at the current “Your recordings”
step instead of marking an older render as the new take’s completed render.
The ready-to-finish message and omission of obsolete downstream completion
are verified by a regression fixture; native visual confirmation remains pending.

Saved presenter playback now participates in bounded media recovery. A failed
load explicitly says the recording is saved and offers file reload, with no
generation. The saved-presenter DOM regression verifies activity updates retain
the connected media element and do not reassign its source. These are protocol
checks; native playback/recovery visual acceptance remains outstanding.

Recording uploads now have a two-minute client deadline. Protocol tests cover
a stalled request, a stalled response body, timer cleanup and exactly one PUT.
The existing save failure path retains the browser take and returns to review.
An aborted response does not prove that the server write failed; the message
asks the user to check the scene before saving again. There is no automatic
mutation retry. Native timeout/recovery appearance remains unverified.

Video notebook URLs now retain stable scene/moment IDs and restore their saved
selection when opened. Checks cover a recorded scene, reordered scenes and
removed IDs. This preserves navigation context across refreshes; it does not
preserve an unsaved browser recording blob. Native reopening remains pending.

Creative composition now has a four-minute wall deadline, sixty-second
inactivity deadline and thirty-tool-call cap in addition to its existing
submission budget. `checks/presenter-finish.live.mjs` copies a retained isolated
diagnostic and runs one real composition/final compositor check against its
saved presenter take. The first run stopped on its inactivity limit in
`/var/folders/qs/c7jp5csj6vx6wpmn3qylx7bh0000gn/T/studio-presenter-finish-live-1bUNco`;
it did not produce a final video. The creator’s current notebook is unchanged.

Native Scene 3 verification now proves the saved 28.466s take loads with
readyState 4 and no media error. The single canvas transport plays and pauses
it (paused at approximately 14s), with the presenter beside the slide and
“Finish scene 3” visible. Screenshot: `/tmp/studio-global-recording-controls.png`.
FFmpeg decoded its Opus audio: mean -31.5 dB, peak -7.7 dB. This proves recorded
sound, not a transcript match. This older scene has no separate animation yet,
so synchronized moving animation plus presenter remains to be verified after
a successful final render.

Claude now requests partial streaming messages and emits throttled activity
for actual incoming chunks without persisting private reasoning or partial
code. Protocol checks cover redaction and ignoring pings. The stopped isolated
finish run has not been retried after this correction.

Presenter finishing follow-up (2026-10-01): isolated run `studio-presenter-finish-live-gtXdTk`, composition `7b52afa6-dda0-4f5c-9a1d-b62e7b26ecb4`, terminated at the four-minute wall limit. Partial activity was received throughout, confirming the streaming fix; no accepted HTML composition or current final video was produced. Actual take `7818ca06-81b6-4a8a-82f5-c564f39a5c78` remains intact. This is a failed finishing gate, not completed presenter rendering. No automatic retry. Removed camera/overlay assembly instructions from content-only generation packet; final assembly remains app-owned. Native saved-recording playback now moves the moment playhead and time anchor per animation frame; screenshot `/tmp/studio-recording-playhead-refined.png`.

Token accounting follow-up: Claude message_start/message_delta usage is retained per provider message ID, merged monotonically with completed assistant usage, and superseded by final run totals. Interrupted streams remain explicitly partial; usage unavailable before a provider report remains unknown. Duplicate deltas do not add token counts twice. Tested interrupted draft, completed-message deduplication and stream closure; 297 tests passed. Historical run totals cannot be reconstructed from private/unreported chunks and were not rewritten.

Composition effort is now explicit (`high` for Claude Code), forwarded to the CLI and persisted in the engine run alongside the requested model. No model substitution or increased time/tool limits. New isolated presenter check `studio-presenter-finish-live-krCQPe` started with the corrected content-only packet; completion remains unproven until accepted composition, rendered output and playback are inspected.

Unsaved browser recording safeguard: beforeunload requests the native leave-page warning during recording, review and upload. Saved/idle playback remains unblocked. Browser-enforced dialog behavior with a new physical unsaved take remains a native acceptance gate; production build passes. This does not promise recovery after browser crash or forced closure.

Scene-producer 0.1.1 guidance aligns content-only runs with app-owned presenter/overlay/sound assembly and asks for bounded reads and an early complete candidate followed by concrete validation corrections. Existing live check `krCQPe` already installed 0.1.0 and is not affected mid-run. Guidance change is not evidence of generation quality or finishing success. Full 297-test suite passed.

Bounded presenter check `krCQPe` ended at the four-minute wall limit (composition `9ea01843-18a5-4521-9aec-e3fefabea5ad`, effort high). Provider-reported partial usage: {"input": 22, "output": 14314, "cacheRead": 411375, "cacheWrite": 56743, "final": false}. No accepted composition or current MP4. Genuine streaming activity continued, so this is generation failing to deliver within budget, not loss of connectivity. Original notebook/take untouched. No automatic retry; producer guidance 0.1.1 was committed during this run and has not yet been live-verified.
