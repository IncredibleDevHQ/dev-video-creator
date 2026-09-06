// Core §13.1 (take) with the §24/§25.1 additions — takes/<id>/take.json:
// steps/overlays/deltas against the reference clock t0, tracks, media
// feed(s), turns and manual floor actions (several speakers), and the §28.9
// recorded layout events.
export const takeSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'incredible-studio/take/v1',
  type: 'object',
  properties: {
    version: { type: 'integer' },
    id: { type: 'string' },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          stepId: { type: 'string' },
          atMs: { type: 'number', minimum: 0 },
        },
        required: ['stepId', 'atMs'],
      },
    },
    overlays: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          actionId: { type: 'string' },
          atMs: { type: 'number', minimum: 0 },
        },
        required: ['actionId', 'atMs'],
      },
    },
    tracks: {
      type: 'object',
      description:
        'landmark tracks at project fps; per-speaker objects when several speakers (§24)',
      additionalProperties: true,
    },
    deltas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          stepId: { type: 'string' },
          earlyMs: { type: 'number' },
        },
        required: ['stepId', 'earlyMs'],
      },
    },
    media: {
      description: 'single feed (§13.1) or an array of feeds with offsets (§24)',
      oneOf: [
        {
          type: 'object',
          properties: {
            cameraUrl: { type: 'string' },
            micUrl: { type: 'string' },
            t0: { type: 'number', minimum: 0 },
          },
          required: ['t0'],
        },
        {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              feedId: { type: 'string' },
              kind: { enum: ['camera', 'mic', 'screen', 'remote'] },
              url: { type: 'string' },
              offsetMs: { type: 'number' },
            },
            required: ['feedId', 'url'],
          },
        },
      ],
    },
    turns: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          speaker: { type: 'string' },
          fromMs: { type: 'number', minimum: 0 },
          toMs: { type: 'number', minimum: 0 },
          source: { enum: ['auto', 'manual', 'diarization', 'vad'] },
        },
        required: ['speaker', 'fromMs', 'toMs'],
      },
    },
    manual: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          atMs: { type: 'number', minimum: 0 },
          action: { type: 'string', description: 'floor → speaker' },
        },
        required: ['atMs', 'action'],
      },
    },
    layout: {
      type: 'array',
      description: 'recorded layout events (§28.9)',
      items: {
        type: 'object',
        properties: {
          atMs: { type: 'number', minimum: 0 },
          family: { type: 'string' },
          source: { enum: ['track', 'offer', 'escape', 'manual'] },
        },
        required: ['atMs', 'family'],
      },
    },
  },
  required: ['id', 'steps', 'media'],
} as const
