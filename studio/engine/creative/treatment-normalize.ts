import {
  TREATMENT_SCHEMA_VERSION,
  ASSET_DECISIONS,
  type RecipeSource,
  type TreatmentChannel,
  type TreatmentExample,
  type TreatmentLedger,
  type LedgerRate,
  type LedgerEvent,
  type ContinuitySide,
  type SceneTreatmentV1
} from './treatment-model'
const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown, limit = 2000) =>
  typeof value === 'string' ? value.trim().slice(0, limit) : ''
const texts = (value: unknown, limit = 600) =>
  (Array.isArray(value) ? value : [])
    .map((entry) => text(entry, limit))
    .filter(Boolean)
const records = (value: unknown) =>
  Array.isArray(value) ? value.filter(isRecord) : []
const oneOf = <T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T
): T =>
  (allowed as readonly string[]).includes(String(value))
    ? (value as T)
    : fallback

const channelOrNull = <T>(
  value: unknown,
  read: (entry: Record<string, unknown>) => T
): T | null => (isRecord(value) ? read(value) : null)
// A number as given, NaN when it is not one — validation says so.
const numeric = (value: unknown) =>
  value === null || value === undefined || value === ''
    ? Number.NaN
    : Number(value)

const ledgerOf = (value: unknown): TreatmentLedger | null => {
  if (!isRecord(value)) return null
  const capacity = numeric(value.capacity)
  return {
    quantity: text(value.quantity, 200),
    capacity: Number.isFinite(capacity) ? capacity : null,
    initial: numeric(value.initial),
    ...(value.rates !== undefined
      ? {
          rates: records(value.rates).map((rate) => ({
            id: text(rate.id, 80),
            what: text(rate.what, 300),
            change: text(rate.change, 20) as LedgerRate['change'],
            amount: numeric(rate.amount)
          }))
        }
      : {}),
    events: records(value.events).map((event) => ({
      moment: text(event.moment, 80),
      what: text(event.what, 300),
      change: text(event.change, 20) as LedgerEvent['change'],
      amount:
        event.amount === undefined && text(event.change, 20) === 'refuse'
          ? 0
          : numeric(event.amount),
      ...(event.needs !== undefined ? { needs: numeric(event.needs) } : {}),
      after: numeric(event.after),
      ...(event.rate !== undefined &&
      event.rate !== null &&
      text(event.rate, 80)
        ? { rate: text(event.rate, 80) }
        : {})
    })),
    final: numeric(value.final)
  }
}

const sideOf = (value: unknown): ContinuitySide => {
  if (!isRecord(value)) return { kind: '' as ContinuitySide['kind'] }
  const revision = numeric(value.revision)
  return {
    kind: text(value.kind, 40) as ContinuitySide['kind'],
    ...(text(value.scene, 120) ? { scene: text(value.scene, 120) } : {}),
    ...(Number.isFinite(revision) ? { revision } : {}),
    ...(text(value.note, 600) ? { note: text(value.note, 600) } : {})
  }
}

const exampleOf = (value: unknown): TreatmentExample | null => {
  if (!isRecord(value)) return null
  const example = {
    before: text(value.before, 240),
    action: text(value.action, 240),
    after: text(value.after, 240),
    unchanged: text(value.unchanged, 240) || null,
    observed: text(value.observed, 240),
    later: text(value.later, 240) || null
  }
  return Object.values(example).some(Boolean) ? example : null
}
/** The example in one line, as the review reads it: before → action → what someone sees. */
export const normalizeTreatment = (raw: unknown): SceneTreatmentV1 => {
  const value = isRecord(raw) ? raw : {}
  const demonstration = isRecord(value.demonstration)
    ? value.demonstration
    : null
  const treatments = isRecord(value.treatments) ? value.treatments : {}
  const requirements = isRecord(value.requirements) ? value.requirements : {}
  const continuity = isRecord(value.continuity) ? value.continuity : {}
  const roster = isRecord(value.rosterProposal) ? value.rosterProposal : null
  const delivery = isRecord(value.delivery) ? value.delivery : {}
  return {
    schemaVersion: value.schemaVersion as typeof TREATMENT_SCHEMA_VERSION,
    scene: text(value.scene, 120),
    originScenes: texts(value.originScenes, 120),
    units: texts(value.units, 80),
    question: text(value.question, 600),
    takeaway: text(value.takeaway, 600),
    evidenceRefs: texts(value.evidenceRefs, 80),
    development: text(value.development, 4000),
    demonstration:
      demonstration && text(demonstration.text)
        ? {
            text: text(demonstration.text, 1600),
            values: records(demonstration.values).map((entry) => ({
              value: text(entry.value, 200),
              basis: entry.basis as 'source' | 'creator' | 'illustrative'
            })),
            ...(exampleOf(demonstration.example)
              ? { example: exampleOf(demonstration.example)! }
              : {})
          }
        : null,
    ledger: ledgerOf(value.ledger),
    moments: records(value.moments).map((moment) => {
      const seconds = Number(moment.estimateSeconds)
      return {
        id: text(moment.id, 80),
        title: text(moment.title, 200),
        purpose: text(moment.purpose, 1000),
        observation: text(moment.observation, 1000),
        narration: channelOrNull(moment.narration, (entry) => ({
          job: text(entry.job, 600),
          guide: text(entry.guide, 2000)
        })),
        objects: channelOrNull(moment.objects, (entry) => ({
          change: text(entry.change, 1000),
          actors: texts(entry.actors, 80),
          beats: records(entry.beats)
            .slice(0, 12)
            .map((beat) => ({
              on: text(beat.on, 300),
              change: text(beat.change, 600)
            }))
        })),
        text: channelOrNull(moment.text, (entry) => ({
          content: text(entry.content, 600),
          role: oneOf(
            entry.role,
            ['term', 'label', 'exact', 'code', 'takeaway'] as const,
            'label'
          )
        })),
        presenter: channelOrNull(moment.presenter, (entry) => ({
          visibility: oneOf(
            entry.visibility,
            ['full', 'shared', 'hidden', 'undecided'] as const,
            'undecided'
          ),
          reason: text(entry.reason, 600)
        })),
        camera: channelOrNull(moment.camera, (entry) => ({
          treatment: text(entry.treatment, 200),
          subject: text(entry.subject, 200),
          reason: text(entry.reason, 600)
        })),
        audio: channelOrNull(moment.audio, (entry) => ({
          cue: text(entry.cue, 200),
          reason: text(entry.reason, 600)
        })),
        attention: text(moment.attention, 300),
        recipes: records(moment.recipes).map((recipe) => ({
          id: text(recipe.id, 120),
          catalog: recipe.catalog as RecipeSource,
          purpose: text(recipe.purpose, 600),
          channel: recipe.channel as TreatmentChannel,
          controls: texts(recipe.controls, 120)
        })),
        evidenceRefs: texts(moment.evidenceRefs, 80),
        estimateSeconds:
          Number.isFinite(seconds) && seconds > 0
            ? Math.round(seconds * 10) / 10
            : null
      }
    }),
    objects: records(value.objects).map((entry) => {
      const asset = isRecord(entry.asset) ? entry.asset : {}
      const parts = records(entry.parts)
        .map((part) => ({ id: text(part.id, 40), what: text(part.what, 300) }))
        .filter((part) => part.id && part.what)
      return {
        entity: text(entry.entity, 80),
        role: text(entry.role, 600),
        appearance: text(entry.appearance, 1000),
        performance: text(entry.performance, 1000),
        ...(parts.length ? { parts } : {}),
        asset: {
          status: oneOf(asset.status, ASSET_DECISIONS, 'undecided'),
          ...(text(asset.ref, 120) ? { ref: text(asset.ref, 120) } : {}),
          ...(text(asset.reason, 600)
            ? { reason: text(asset.reason, 600) }
            : {})
        }
      }
    }),
    treatments: {
      presenter: text(treatments.presenter, 2000),
      text: text(treatments.text, 2000),
      camera: text(treatments.camera, 2000)
    },
    skills: records(value.skills).map((entry) => ({
      skill: text(entry.skill, 80),
      references: texts(entry.references, 200),
      why: text(entry.why, 800)
    })),
    requirements: {
      assets: texts(requirements.assets),
      takes: texts(requirements.takes),
      decisions: texts(requirements.decisions)
    },
    continuity: {
      entry: text(continuity.entry, 1000),
      exit: text(continuity.exit, 1000),
      incoming: sideOf(continuity.incoming),
      outgoing: sideOf(continuity.outgoing)
    },
    unresolved: texts(value.unresolved),
    coverage: records(value.coverage).map((entry) => ({
      unit: text(entry.unit, 80),
      need: text(entry.need, 600),
      moments: texts(entry.moments, 80),
      ...(text(entry.deferred, 600)
        ? { deferred: text(entry.deferred, 600) }
        : {})
    })),
    rosterProposal: roster
      ? {
          action: oneOf(
            roster.action,
            ['split', 'merge', 'resequence'] as const,
            'resequence'
          ),
          scenes: texts(roster.scenes, 120),
          reason: text(roster.reason, 1000)
        }
      : null,
    delivery: {
      voice: oneOf(
        delivery.voice,
        ['human', 'generated', 'silent', 'undecided'] as const,
        'undecided'
      ),
      note: text(delivery.note, 600)
    }
  }
}
