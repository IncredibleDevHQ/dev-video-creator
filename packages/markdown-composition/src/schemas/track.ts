// Core §28.9 — motion/track.json (the layout track): primary family per
// beat, alternates with scores, switch cost and cue time. The §25.1 speaker
// turns schema is included as a reference for stage blocks (Stage.speakers).
export const trackSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'incredible-studio/motion-track/v1',
  type: 'object',
  properties: {
    version: { type: 'integer' },
    mode: { enum: ['off', 'assist', 'auto'], default: 'assist' },
    weights: {
      type: 'object',
      properties: {
        fit: { type: 'number' },
        presence: { type: 'number' },
        continuity: { type: 'number' },
        legibility: { type: 'number' },
        composition: { type: 'number' },
      },
    },
    track: {
      type: 'array',
      items: { $ref: '#/$defs/LayoutTrackRow' },
    },
  },
  required: ['track'],
  $defs: {
    Id: { type: 'string', pattern: '^(?!syn-)[A-Za-z_][\\w.:-]*$' },
    LayoutFamily: {
      enum: [
        'speaker-full', 'speaker-panel', 'split', 'content-pip', 'content-card',
        'content-cutout', 'ots-box', 'takeover', 'gesture', 'speaker-card-board',
        'dual-box', 'dual-wide', 'host-guest', 'dominant', 'trio-row',
        'content-multi', 'split-duo',
      ],
    },
    LayoutOffer: {
      type: 'object',
      properties: {
        family: { $ref: '#/$defs/LayoutFamily' },
        score: { type: 'number' },
        reason: { type: 'string' },
        kind: { enum: ['planned', 'alternate', 'escape'] },
      },
      required: ['family', 'score', 'kind'],
    },
    LayoutTrackRow: {
      type: 'object',
      properties: {
        stepId: { $ref: '#/$defs/Id' },
        class: { enum: ['none', 'slot', 'beside', 'frame', 'takeover'] },
        primary: { $ref: '#/$defs/LayoutFamily' },
        treatment: {
          enum: ['overlay', 'bed', 'separate', 'glow-bed-hero', 'text-behind'],
        },
        alternates: { type: 'array', items: { $ref: '#/$defs/LayoutOffer' }, maxItems: 2 },
        switchCost: { enum: ['none', 'reframe', 'cut'] },
        cueMs: { type: 'number' },
        scores: { type: 'object', additionalProperties: { type: 'number' } },
      },
      required: ['stepId', 'class', 'primary'],
    },
  },
} as const

// Core §25.1 — speaker roster + turn policy (standalone for stage blocks and
// the speaker-crew skill; embedded in Stage when several speakers present).
export const speakersSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'incredible-studio/speakers/v1',
  type: 'object',
  properties: {
    speakers: {
      type: 'array',
      maxItems: 3,
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          role: { enum: ['host', 'guest'] },
          source: { enum: ['shared-camera', 'local', 'remote', 'audio-only'] },
          feedId: { type: 'string' },
          colour: { type: 'string', description: 'theme key' },
        },
        required: ['id', 'role', 'source'],
      },
    },
    nextOwner: { type: 'string' },
    turnPolicy: {
      type: 'object',
      properties: {
        source: { enum: ['auto', 'manual', 'diarization', 'vad'], default: 'auto' },
        dominant: { type: 'boolean', default: true },
        overlap: { enum: ['equalize', 'keep'], default: 'equalize' },
      },
    },
  },
  required: ['speakers'],
} as const
