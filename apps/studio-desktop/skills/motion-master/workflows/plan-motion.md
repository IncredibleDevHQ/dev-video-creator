---
description: Default Plan Motion authority — intake, two confirmations, beat brief, motion lock, per-beat resolution under gates, receipt, handoff.
---

# Plan Motion (Default)

**Pipeline**: Intake → Stage 1 motion contract ⛔ → Stage 2 motion solution ⛔ → Beat brief → Motion lock → Resolve beat by beat (early gate after B05, final gate) → Receipt → Handoff.

**⛔ How a BLOCKING gate works.** Present the fields and your recommendation, then write `motion/gate.json` = `{ "id": "gate-<stage>", "stage": "contract" | "solution" | "question", "fields": [<field names>], "recommendation": {…} }` and exit 0 — the app shows the dialog; never decide on the user's behalf. On resume, read `motion/gate.<id>.answer.json` once, apply the answer and continue at the next step.

### Step 1 · Intake

🚧 GATE: a page (SVG or a block the studio renders) and narration (speaker notes, a literal script, or a transcript with word onsets) exist.

- Run `atomize` on the page: units, edges, containment, reading rows, written back as stable ids (`motion/geometry.json`).
- Run `measure` after fonts are ready: root-space bounds and member CTMs.
- Read the narration; if it has word onsets keep them; otherwise mark `cue: formula`.
- Evaluate the routing trigger table once over the whole page set and read every triggered reference in one batch.

✅ Checkpoint — geometry, narration and references retained.

### Step 2 · Stage 1 — the motion contract ⛔ BLOCKING

Present seven answers and wait for confirmation (the app dialog or chat):

| Field | Question |
|---|---|
| `explain_move` | what must the viewer be able to do after this scene? |
| `pace` | presenter-led with Next, self-running, or published from a take |
| `presence` | no camera, one presenter, two to four speakers; co-located or feeds |
| `stage_default` | free (rule picks the family) or a named family |
| `attention_style` | technical-trace, premium-settle, data-confirm |
| `narration_source` | notes, literal script, transcript with onsets, none yet |
| `constraints` | reduced motion, no camera moves, fixed step count, hard duration |

### Step 3 · Stage 2 — the motion solution ⛔ BLOCKING

Three complete directions, one confirmed: preset, stage family per block, camera policy, overlay slot defaults, turn policy (several speakers), budget posture (sparse / normal / dense), beat-count range per page. Consume the confirmation once.

### Step 4 · Beat brief

Read `${SKILL_DIR}/templates/motion_brief_reference.md`. Run `plan_beats` with narration, geometry and the confirmed contract; write `motion/brief.md`: one block per beat with Move, Speaker, Narration span and cue word, Intent, Hero, Supporting, Relationships used, Stage (Reference), Attribution, Composition (Reference), Overlays (Reference). Then the **beat rhythm check**: no two attentional beats in a row on the same hero; a `recap` closes any page that introduced more than three units; a `breathing` beat after a camera beat. Audit the brief against the confirmation field by field — Gate 1.

### Step 5 · Motion lock

Read `${SKILL_DIR}/templates/motion_lock_reference.md`. Write `motion/lock.md`: preset and its token column, stage base per block, roster with colours and sides, clock precedence, budgets, aspect, reduced-motion flag, validator error/warning split. Compare with the brief — Gate 2. Never a beat-local value.

### Step 6 · Resolve

Per beat, the nine-step chain (`references/levels.md`, `references/core.md`): beat move → clock check → hero and relationship → beat class → stage and slot mix → module line `B<NN> modules: …` → template or actions → orchestration → resolved times. Run `resolve` for the beat; it writes into `motion/resolved.json`.

**Cadence (mandatory).** After B05 of the first page run `validate --stage early`; read the `gate-signal`: two issues sharing a category are a method fault → fix the rule or the lock before B06; one isolated issue is beat-local. Continue without checker calls. After the last beat run `validate --stage final`; one consolidated repair pass; one rerun. Never validate between individual fixes.

### Step 7 · Receipt and handoff

Run `receipt`; compare with the brief; write a reason for every absence (a `relate` beat with no trace, a `quantify` beat with no count, a two-speaker beat without attribution). Repair at the owning layer if a reason cannot be given. Hand `motion/resolved.json` to the studio compiler; run `frames` for the review sheet.

## ✅ Plan Motion complete
- [x] contract and solution confirmed once and consumed once
- [x] brief and lock written, Gates 1–2 passed
- [x] every beat resolved; early and final gates passed; one consolidated repair pass each
- [x] receipt reconciled; resolved plan handed off
