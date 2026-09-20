// The scene revision contract (§3.9): the complete editable direction of one
// scene — words, program, compiled motion, staging and layout intent — as one
// canonical payload, with the artwork hashed alongside it. Every side derives
// the same digest over `svg + stableStringify(payload)`:
//  - the build dispatch captures it at run start (inputs.scenes[].revision),
//    so a mid-run edit of beat motion or camera/layout is a reviewable
//    conflict at finish, never a silent overwrite;
//  - the finish stamps it into the receipt (applied) and re-derives it on
//    re-application; the status tool reports drift against the same digest.
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
