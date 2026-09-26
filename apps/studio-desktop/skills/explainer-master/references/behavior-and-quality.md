# Studio behavior, scheduling and quality contract

New programs keep `version:1` and opt into `scheduling:2`. Existing programs
retain their original ordering until deliberately upgraded. Time is milliseconds;
convert frame references at the source FPS. Use the measured narration clock.

Every event has an ID. Independent cue events overlap. `anchor` can be `start`,
`arrival`, `outcome` or `settled`: the compiler positions supporting motion around
that milestone. `dependsOn:[{event:"receive",milestone:"arrival"}]` waits for the
named milestone. `after:"receive"` waits for settlement. Cycles, missing ports,
missing cues, overlapping property writes, impossible preparation and action
truncation are errors. Fix them; never stretch the voice to hide the conflict.
`heading` is optional visible text; a beat ID is never a caption.

## Reusable behaviors

`action:"behavior"` carries `behavior:{definition,request?,destination?,amount?}`.
The immutable definition has `version:1,key,artworkKey,name,requiredParts,port?,clip?,
duration:{minMs,defaultMs,maxMs},controls?`. Names: receive, consume, process,
reject, refill, enqueue, release, recover. These expand to the existing motion
operations. Bind actual named ports and finite performances. Missing rig parts
are repair requests, not permission to substitute a glow. Consume/refill write
the cast's single visible quantity; never animate a second independent inventory.

Controls declare `id,label,type,default,min?,max?,parts,property,invalidates`.
Types are color/number. Properties are accent, scale, emphasis and durationMs.
Counts, factual labels and acceptance decisions are not appearance controls.
The editor exposes Refine appearance for registered artwork. Duration changes
must go through schedule review. Original library versions remain recoverable.

Use `explainer_register_repair` with parentKey, svgPath, reviewPath and behaviors
for local fixes. Review JSON contains sourceHash (SHA256 of exact SVG), captured
frame paths and concrete observations. Do not invent a review. The returned key
is the immutable version to reuse in subsequent notebooks.

## Continuity

For related beats keep actors present rather than replaying entrance events.
`initialState` explicitly carries actor id, dx,dy,scale,visible,quantity,state and
original bounds. Review returns `boundaryState`. Carry only matching actor
geography into the next scene; otherwise choose a settled cut. A presenter
return must not restart the object's clip. See [camera and continuity](camera-continuity.md).

## Executable checkpoint

1. Author ONE representative mechanism and its minimal cast.
2. `explainer_preview` captures the export composition with semantic timestamps.
3. Narrate or align the selected take; fix all schedule diagnostics.
4. Inspect before/action/outcome/settled frames and backward seeking.
5. `explainer_reference_export` renders its real short MP4. View and listen.
6. `explainer_accept` records review with hash, exportHash, score (0–100),
   limitations, listened:true, and checks for render/design/causal/viewing.
   Every check includes event, atMs, expected, observed and passed.
7. Only after acceptance may another scheduling:2 scene be previewed.
   Every current scene needs accepted quality evidence before finish.

A generated frame or zero-error preview is not visual approval. Evidence must
identify the actual event and visible outcome. Missing viewing/listening evidence
leaves the checkpoint incomplete. The highest explicitly accepted score is kept;
when equal, fewer known limitations wins. Do not automatically pick the latest.

This is a native SVG/GSAP workflow. Do not launch Skottie or a Lottie player.

Use `explainer_import` to place an accepted immutable library version in another scene without provider regeneration. `explainer_frame` takes the current render revision and a millisecond time, returning the composed frame and resolved bounds. Re-preview after changing narration: reference export refuses audio outside the reviewed manifest. Explicit carry snapshots include finite clip positions as well as quantity, position and visibility.
