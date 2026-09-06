// Core §3.2 — incredible-studio/slide-motion/v2 (plan tier), transcribed
// verbatim from The Motion Decision Core §3.2. The resolved tier for
// motion/resolved.json lives in ./resolved.ts.
export const slideMotionV2Schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'incredible-studio/slide-motion/v2',
  type: 'object',
  properties: {
    motion: { $ref: '#/$defs/PageMotion' },
    steps: { type: 'array', minItems: 1, maxItems: 24, items: { $ref: '#/$defs/Step' } },
    takes: { type: 'array', items: { $ref: '#/$defs/Take' } },
  },
  required: ['steps'],
  $defs: {
    Id: { type: 'string', pattern: '^(?!syn-)[A-Za-z_][\\w.:-]*$' },
    IdList: { type: 'array', items: { $ref: '#/$defs/Id' }, uniqueItems: true },
    Point: {
      type: 'object',
      properties: { x: { type: 'number' }, y: { type: 'number' } },
      required: ['x', 'y'],
    },
    Rect: {
      type: 'object',
      properties: {
        x: { type: 'number' },
        y: { type: 'number' },
        w: { type: 'number', exclusiveMinimum: 0 },
        h: { type: 'number', exclusiveMinimum: 0 },
      },
      required: ['x', 'y', 'w', 'h'],
    },
    UnitRef: {
      type: 'object',
      properties: {
        unit: { $ref: '#/$defs/Id' },
        port: { enum: ['auto', 'center', 'top', 'bottom', 'left', 'right'], default: 'auto' },
      },
      required: ['unit'],
    },
    EaseAnchor: {
      enum: ['enter', 'settle', 'travel', 'camera', 'exit', 'pop', 'popOver', 'draw', 'pulse'],
    },
    Targets: {
      oneOf: [{ $ref: '#/$defs/IdList' }, { enum: ['others', 'all', 'hero', 'supporting'] }],
    },
    Timing: {
      type: 'object',
      'x-tier': 'advanced',
      properties: {
        sequence: { enum: ['chain', 'parallel'], default: 'chain' },
        offsetMs: { type: 'number', default: 0 },
        durationMs: { type: 'number', minimum: 0 },
        staggerMs: { type: 'number', minimum: 0 },
        staggerOrigin: {
          enum: ['narration', 'reading', 'hero', 'center', 'first', 'last', 'path', 'reverse'],
        },
      },
    },
    Release: {
      type: 'object',
      properties: {
        on: { enum: ['next-hero', 'explicit', 'page-end'], default: 'next-hero' },
        ms: { type: 'number', default: 300 },
      },
    },
    CameraTarget: {
      oneOf: [
        { const: 'page' },
        { const: 'keep' },
        {
          type: 'object',
          properties: {
            units: { $ref: '#/$defs/IdList' },
            rect: { $ref: '#/$defs/Rect' },
            transition: { enum: ['auto', 'direct', 'via-page'], default: 'auto' },
            dwellMs: { type: 'number', minimum: 0 },
          },
        },
      ],
    },
    RevealValue: {
      type: 'object',
      properties: {
        enterFrom: {
          enum: ['auto', 'up', 'down', 'left', 'right', 'hero', 'reading', 'none'],
          default: 'auto',
        },
        lines: { enum: ['auto', 'block', 'per-line'], default: 'auto' },
      },
    },
    DimValue: {
      type: 'object',
      properties: { level: { type: 'number', minimum: 0.15, maximum: 1 } },
    },
    EmphasizeValue: {
      type: 'object',
      properties: { factor: { type: 'number', minimum: 1, maximum: 1.08 } },
    },
    PulseValue: {
      type: 'object',
      properties: { repeats: { type: 'integer', minimum: 1, maximum: 2, default: 1 } },
    },
    MoveValue: {
      type: 'object',
      properties: {
        freeform: { type: 'boolean', default: false, 'x-tier': 'advanced' },
        labelMode: { enum: ['followCenter', 'scaleWith', 'static'], default: 'followCenter' },
        connectors: { enum: ['auto', 'tween', 'redraw', 'detach'], default: 'auto' },
      },
    },
    ConnectValue: {
      type: 'object',
      properties: {
        mode: { enum: ['highlight', 'author'], default: 'highlight' },
        direction: { enum: ['forward', 'reverse'], default: 'forward' },
        arrowhead: { type: 'boolean', default: true },
        strokeLike: { $ref: '#/$defs/Id' },
      },
    },
    TraceValue: {
      type: 'object',
      properties: {
        direction: { enum: ['auto', 'forward', 'reverse', 'fromHero'], default: 'auto' },
        markerMode: { enum: ['hideUntilDrawn', 'keep'], default: 'hideUntilDrawn' },
      },
    },
    MorphValue: {
      type: 'object',
      properties: { toUnit: { $ref: '#/$defs/Id' }, toPath: { type: 'string' } },
    },
    SwapValue: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        href: { type: 'string' },
        style: { enum: ['crossfade', 'slide'], default: 'crossfade' },
      },
    },
    CountValue: {
      type: 'object',
      properties: {
        fromMode: { enum: ['current', 'zero', 'explicit'], default: 'current' },
        from: { type: 'number' },
        to: {
          oneOf: [
            { type: 'number' },
            { type: 'string', description: 'authored string; parsed with the unit numeric format' },
          ],
        },
      },
      required: ['to'],
    },
    ExitValue: {
      type: 'object',
      properties: {
        style: { enum: ['auto', 'fade', 'dissolve', 'moveOut'], default: 'auto' },
        direction: { enum: ['reading', 'up', 'down', 'left', 'right'] },
      },
    },
    Action: {
      type: 'object',
      properties: {
        id: { $ref: '#/$defs/Id' },
        op: {
          enum: [
            'reveal', 'trace', 'dim', 'undim', 'emphasize', 'pulse', 'move',
            'connect', 'camera', 'morph', 'swap', 'count', 'exit',
          ],
        },
        targets: { $ref: '#/$defs/Targets' },
        except: { $ref: '#/$defs/IdList' },
        from: { $ref: '#/$defs/UnitRef' },
        to: { oneOf: [{ $ref: '#/$defs/UnitRef' }, { $ref: '#/$defs/Point' }] },
        camera: { $ref: '#/$defs/CameraTarget' },
        value: { type: 'object' },
        release: { $ref: '#/$defs/Release' },
        timing: { $ref: '#/$defs/Timing' },
        ease: { $ref: '#/$defs/EaseAnchor', 'x-tier': 'advanced' },
        implicit: { type: 'boolean', default: false, readOnly: true },
      },
      required: ['op'],
      allOf: [
        { if: { properties: { op: { const: 'reveal' } } }, then: { required: ['targets'], properties: { value: { $ref: '#/$defs/RevealValue' } } } },
        { if: { properties: { op: { const: 'trace' } } }, then: { required: ['targets'], properties: { value: { $ref: '#/$defs/TraceValue' } } } },
        { if: { properties: { op: { enum: ['dim', 'undim'] } } }, then: { required: ['targets'], properties: { value: { $ref: '#/$defs/DimValue' } } } },
        { if: { properties: { op: { const: 'emphasize' } } }, then: { required: ['targets'], properties: { value: { $ref: '#/$defs/EmphasizeValue' } } } },
        { if: { properties: { op: { const: 'pulse' } } }, then: { required: ['targets'], properties: { value: { $ref: '#/$defs/PulseValue' } } } },
        { if: { properties: { op: { const: 'move' } } }, then: { required: ['id', 'targets', 'to'], properties: { value: { $ref: '#/$defs/MoveValue' } } } },
        { if: { properties: { op: { const: 'connect' } } }, then: { required: ['id', 'from', 'to'], properties: { value: { $ref: '#/$defs/ConnectValue' } } } },
        { if: { properties: { op: { const: 'camera' } } }, then: { required: ['id', 'camera'] } },
        { if: { properties: { op: { const: 'morph' } } }, then: { required: ['id', 'targets'], properties: { value: { $ref: '#/$defs/MorphValue' } } } },
        { if: { properties: { op: { const: 'swap' } } }, then: { required: ['id', 'targets'], properties: { value: { $ref: '#/$defs/SwapValue' } } } },
        { if: { properties: { op: { const: 'count' } } }, then: { required: ['targets'], properties: { value: { $ref: '#/$defs/CountValue' } } } },
        { if: { properties: { op: { const: 'exit' } } }, then: { required: ['targets'], properties: { value: { $ref: '#/$defs/ExitValue' } } } },
      ],
    },
    Step: {
      type: 'object',
      properties: {
        id: { $ref: '#/$defs/Id' },
        title: { type: 'string', maxLength: 120 },
        explanation: { type: 'string', maxLength: 1200 },
        narration: {
          type: 'object',
          properties: {
            sentences: { type: 'array', items: { type: 'integer', minimum: 0 } },
            cueWordIndex: { type: 'integer', minimum: 0 },
          },
        },
        intent: {
          enum: [
            'introduce', 'locate', 'relate', 'contrast', 'transform',
            'quantify', 'emphasize', 'flow', 'recap', 'transition',
          ],
        },
        template: {
          enum: [
            'reveal-group', 'trace-flow', 'compare-two', 'zoom-and-explain',
            'emphasize', 'transform', 'count-up', 'recap', 'handoff',
          ],
        },
        hero: { $ref: '#/$defs/IdList' },
        supporting: { $ref: '#/$defs/IdList' },
        reveals: { $ref: '#/$defs/IdList' },
        verb: { enum: ['reveal', 'trace', 'focus'] },
        actions: { type: 'array', items: { $ref: '#/$defs/Action' }, maxItems: 12 },
        timing: {
          type: 'object',
          properties: {
            holdMs: { type: 'number', minimum: 0 },
            durationMs: { type: 'number', minimum: 0 },
            fit: { enum: ['compress', 'clamp'], default: 'compress' },
          },
        },
      },
      required: ['title'],
      // Core §3.2 writes oneOf here, but its own worked examples combine
      // intent+hero with actions (§3.3 (a)) — exactly-one is unenforceable,
      // so this is anyOf: a step must take at least one of the three forms.
      anyOf: [
        { required: ['reveals'] },
        { required: ['actions'] },
        { required: ['intent', 'hero'] },
      ],
    },
    Take: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        steps: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              stepId: { $ref: '#/$defs/Id' },
              atMs: { type: 'number', minimum: 0 },
            },
            required: ['stepId', 'atMs'],
          },
        },
      },
      required: ['id', 'steps'],
    },
    PageMotion: {
      type: 'object',
      properties: {
        preset: { enum: ['technical-trace', 'premium-settle', 'data-confirm'] },
        durationScale: { type: 'number', minimum: 0.8, maximum: 1.25 },
        speed: { type: 'number', minimum: 0.5, maximum: 2, default: 1 },
        reducedMotion: { type: 'boolean', default: false },
        unreferenced: { enum: ['static', 'hidden'], default: 'static' },
        fit: { enum: ['cue', 'scale-holds', 'clamp'], default: 'scale-holds' },
        anchors: { type: 'object', additionalProperties: { $ref: '#/$defs/Id' } },
        loop: { type: 'object', properties: { closure: { enum: ['seam', 'hard'], default: 'seam' } } },
        presenter: {
          type: 'object',
          properties: {
            nextDuringMotion: { enum: ['fastForward', 'snap'], default: 'fastForward' },
          },
        },
        geometry: { $ref: '#/$defs/Geometry' },
      },
    },
    Geometry: {
      type: 'object',
      readOnly: true,
      properties: {
        svgHash: { type: 'string' },
        measured: {
          type: 'object',
          properties: {
            fontsReady: { type: 'boolean' },
            at: { enum: ['editor', 'driver'] },
          },
        },
        viewBox: { $ref: '#/$defs/Rect' },
        readingMode: { enum: ['ltr-ttb', 'center-out', 'hub-spoke', 'timeline', 'chain', 'grid'] },
        units: {
          type: 'object',
          additionalProperties: {
            type: 'object',
            properties: {
              kind: {
                enum: ['group', 'box', 'label', 'connector', 'shape', 'frame', 'image', 'number'],
              },
              label: { type: 'string' },
              role: { enum: ['focal', 'support', 'accent', 'chrome', 'anchor'] },
              bbox: { $ref: '#/$defs/Rect' },
              members: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { $ref: '#/$defs/Id' },
                    ctm: { type: 'array', items: { type: 'number' }, minItems: 6, maxItems: 6 },
                  },
                  required: ['id', 'ctm'],
                },
              },
              fontPx: { type: 'number' },
              textAnchor: { enum: ['start', 'middle', 'end'] },
              lines: { type: 'array', items: { $ref: '#/$defs/Rect' } },
              tspans: { type: 'integer' },
              pathLength: { type: 'number' },
              numeric: {
                type: 'object',
                properties: {
                  value: { type: 'number' },
                  prefix: { type: 'string' },
                  suffix: { type: 'string' },
                  decimals: { type: 'integer' },
                  groupSeparator: { type: 'string' },
                  decimalSeparator: { type: 'string' },
                },
              },
            },
          },
        },
        edges: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              connector: { $ref: '#/$defs/Id' },
              from: { $ref: '#/$defs/Id' },
              to: { $ref: '#/$defs/Id' },
              directed: { type: 'boolean' },
              fromPoint: { $ref: '#/$defs/Point' },
              toPoint: { $ref: '#/$defs/Point' },
              markerStart: { type: 'boolean' },
              markerEnd: { type: 'boolean' },
            },
          },
        },
        contains: { type: 'object', additionalProperties: { $ref: '#/$defs/IdList' } },
        rows: { type: 'array', items: { $ref: '#/$defs/IdList' } },
      },
    },
  },
} as const
