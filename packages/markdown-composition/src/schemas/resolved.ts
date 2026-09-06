// Core §3.2 resolved tier — motion/resolved.json. The Core defines the plan
// tier as a JSON schema and the resolved tier in prose ("ResolvedStep:
// actions with absolute startMs, durationMs, curve, pivot, ports, path d,
// persistence, motionWindowMs, holdMs, plus materialized implicit actions
// keyed by Step.id"); this is that prose made structural, matching what the
// studio resolver emits.
export const resolvedSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'incredible-studio/motion-resolved/v1',
  type: 'object',
  properties: {
    version: { type: 'integer' },
    preset: { enum: ['technical-trace', 'premium-settle', 'data-confirm'] },
    steps: {
      type: 'array',
      minItems: 1,
      maxItems: 24,
      items: { $ref: '#/$defs/ResolvedStep' },
    },
  },
  required: ['steps'],
  $defs: {
    Id: { type: 'string', pattern: '^(?!syn-)[A-Za-z_][\\w.:-]*$' },
    IdList: { type: 'array', items: { $ref: '#/$defs/Id' }, uniqueItems: true },
    EaseAnchor: {
      enum: ['enter', 'settle', 'travel', 'camera', 'exit', 'pop', 'popOver', 'draw', 'pulse'],
    },
    Point: {
      type: 'object',
      properties: { x: { type: 'number' }, y: { type: 'number' } },
      required: ['x', 'y'],
    },
    ResolvedAction: {
      type: 'object',
      properties: {
        id: { $ref: '#/$defs/Id' },
        op: {
          enum: [
            'reveal', 'trace', 'dim', 'undim', 'emphasize', 'pulse', 'move',
            'connect', 'camera', 'morph', 'swap', 'count', 'exit',
          ],
        },
        targets: { $ref: '#/$defs/IdList' },
        startMs: { type: 'number', minimum: 0 },
        durationMs: { type: 'number', minimum: 0 },
        ease: { $ref: '#/$defs/EaseAnchor' },
        pivot: { $ref: '#/$defs/Point' },
        ports: {
          type: 'object',
          properties: {
            from: { $ref: '#/$defs/Id' },
            to: { $ref: '#/$defs/Id' },
          },
        },
        path: { type: 'string', description: 'path d for move/trace synthesis' },
        value: { type: 'object' },
        persistence: { enum: ['state', 'flourish'] },
        implicit: { type: 'boolean' },
      },
      required: ['op', 'targets', 'startMs', 'durationMs', 'ease', 'persistence'],
    },
    ResolvedStep: {
      type: 'object',
      properties: {
        id: { $ref: '#/$defs/Id' },
        title: { type: 'string', maxLength: 120 },
        explanation: { type: 'string', maxLength: 1200 },
        intent: {
          enum: [
            'introduce', 'locate', 'relate', 'contrast', 'transform',
            'quantify', 'emphasize', 'flow', 'recap', 'transition',
          ],
        },
        hero: { $ref: '#/$defs/IdList' },
        supporting: { $ref: '#/$defs/IdList' },
        actions: { type: 'array', items: { $ref: '#/$defs/ResolvedAction' } },
        motionWindowMs: { type: 'number', minimum: 0 },
        holdMs: { type: 'number', minimum: 0 },
      },
      required: ['id', 'title', 'actions', 'motionWindowMs', 'holdMs'],
    },
  },
} as const
