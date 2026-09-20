// The scene revision contract (§3.9): the complete editable direction of one
// scene — words, program, compiled motion, staging and layout intent — as one
// canonical payload, with the artwork hashed alongside it. Every side derives
// the same digest over `svg + stableStringify(payload)`:
//  - the build dispatch captures it at run start (inputs.scenes[].revision),
//    so a mid-run edit of beat motion or camera/layout is a reviewable
//    conflict at finish, never a silent overwrite;
//  - the finish stamps it into the receipt (applied) and re-derives it on
//    re-application; the status tool reports drift against the same digest;
//  - the finish also pins the rendered superset (sceneRenderedExtras) into
//    the receipt (rendered) and the scene's explainer stamp, and the export
//    and the publish badge re-verify that whole rendered performance.
// Canonicalization (sorted keys) lives in the callers' stableStringify; this
// module only fixes WHICH fields a revision is made of, and normalizes absent
// attributes to null so tiptap defaults, stored JSON and run files agree.
export const SCENE_REVISION_ATTRS = [
  'title',
  'script',
  'sourceText',
  'program',
  'motion',
  'windows',
  'stageTrack',
  'stagePlacements',
  'directorAuto',
  'directorNotes',
] as const

export const sceneRevisionPayload = (
  attrs: Record<string, unknown> | null | undefined,
  extras: Record<string, unknown> = {},
): Record<string, unknown> => ({
  ...Object.fromEntries(SCENE_REVISION_ATTRS.map(name => [name, attrs?.[name] ?? null])),
  ...extras,
})

// The rendered superset of a scene revision (issue #17): everything the
// export engine draws or plays beyond the node's own direction — camera
// framing, block duration, the narration/presenter tracks and the selected
// take's identity. The finish pins it into the receipt (rendered) and the
// scene's explainer stamp; the export and the publish badge re-derive it, so
// a post-finish swap of any rendered input invalidates the export until the
// scene is re-applied or rebuilt. Take-flow state the finish manages itself
// (track attachment, take disposition) is pinned at apply time, which keeps
// it out of the mid-run conflict digest.
export const sceneRenderedExtras = (
  block: { camera?: unknown; durationMs?: unknown } | null | undefined,
  presenterTracks: unknown,
  recorded: unknown,
): Record<string, unknown> => ({
  camera: block?.camera ?? null,
  durationMs: block?.durationMs ?? null,
  presenterTracks: presenterTracks ?? null,
  recorded: recorded ?? null,
})
