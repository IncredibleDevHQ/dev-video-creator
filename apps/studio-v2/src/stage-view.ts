// The build panel's stage checklist (§5.5): a build run's durable stage
// checkpoints in plain language. A needs-input stage is the build waiting
// for its person — an intentional saved state, never rendered as a failure.
export type BuildStageRow = {
  stage: string
  status: string
  detail?: { scene?: string; review?: Array<{ beat: number; note: string }> } | null
  updatedAt?: string
}

export type StageViewRow = {
  text: string
  tone: 'quiet' | 'active' | 'waiting' | 'failed'
  indent: boolean
}

const STATE_LABEL: Record<string, string> = {
  pending: 'pending',
  running: 'running…',
  succeeded: 'done',
  'needs-input': 'waiting for you',
  failed: 'failed',
  cancelled: 'cancelled',
  stale: 'stale',
}

const toneFor = (status: string): StageViewRow['tone'] =>
  status === 'needs-input'
    ? 'waiting'
    : status === 'failed' || status === 'cancelled'
      ? 'failed'
      : status === 'running'
        ? 'active'
        : 'quiet'

export const stageRowsFor = (stages: BuildStageRow[]): StageViewRow[] =>
  stages.flatMap(stage => {
    const rows: StageViewRow[] = [
      {
        text: `${stage.stage} · ${STATE_LABEL[stage.status] || stage.status}`,
        tone: toneFor(stage.status),
        indent: false,
      },
    ]
    // The checkpoint says exactly which beats need a person; show them under
    // the stage rather than leaving "waiting" as a riddle.
    if (stage.status === 'needs-input') {
      for (const item of stage.detail?.review || []) {
        rows.push({ text: `beat ${item.beat}: ${item.note}`, tone: 'waiting', indent: true })
      }
    }
    return rows
  })
