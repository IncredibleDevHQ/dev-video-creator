// Stops saved by older builds, in the words the engine uses now (review 5).
const LEGACY_STOPS: Array<[string, string]> = [
  [
    'Stopped at the stage time limit. Saved artifacts are available; retry requires your action',
    'The agent ran out of time. Saved work is kept; Try again continues from there'
  ],
  [
    'Stopped after no harness activity. Saved artifacts are available; retry requires your action',
    'The agent stopped responding. Saved work is kept; Try again continues from there'
  ],
  [
    'Stopped at the tool-call limit. Saved artifacts are available; retry requires your action',
    'The agent used up its steps. Saved work is kept; Try again continues from there'
  ],
  [
    'Generation stopped. Saved slides are available; continue when you are ready',
    'Stopped. Saved work is kept; Try again continues where it stopped'
  ]
]
/** Display older engine status messages using the product's current terminology. */
export const wireframeStatus = (message: string) =>
  LEGACY_STOPS.reduce(
    (text, [old, now]) => text.split(old).join(now),
    message
  ).replace(/\b(presentations?|slides?)\b/gi, (word) => {
    const replacement = word.toLowerCase().endsWith('s')
      ? 'wireframes'
      : 'wireframe'
    return word[0] === word[0].toUpperCase()
      ? replacement[0].toUpperCase() + replacement.slice(1)
      : replacement
  })
