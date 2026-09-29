# Harnesses and skills

The studio's AI work runs on a coding agent the creator is already signed in
to — **Claude Code**, **Codex** or **Kimi** — driven by the desktop app
(`apps/studio-desktop/src/harness/`). Only the wireframe's outline can run on
the direct model instead (an OpenAI key, `server/model-gateway.ts`).

## Which harness does what

A run is started for a **stage**, and the creator chooses a harness and a
model for each in AI settings, with a default for the rest. The choice is a
durable server setting (`server/harness-preferences.ts`), resolved in the
front end by `harness-choice.ts`.

| Stage | Skill | Makes |
| --- | --- | --- |
| `story` | `story-master` | The wireframe's outline, from the source (or the direct model) |
| `drawing` | `page-master` | The presentation's designed pages, one by one |
| `planning` | `video-planner` | A video's Explanation Brief, each scene's plan and its preview |
| `composition` | `scene-producer` | A scene produced from its approved plan |

## A run

`run-manager.ts` starts a run in the project's own folder
(`<data>/projects/<projectId>`), never in this repository:

1. **Skills are installed** into the folder (`skills-install.ts`): the
   vendored `apps/studio-desktop/skills/*` copied to `.claude/skills/`, a
   pointer appended to its `AGENTS.md` once, and `skills.lock` recording each
   skill's version and hash. A skill edited there is kept and marked
   `modifiedLocally`.
2. **The adapter** (`adapters/claude-code.ts`, `codex.ts`, `kimi.ts`) starts
   the CLI in its streaming mode with the chosen model, and a per-run MCP
   configuration pointing at `dist-electron/mcp-stdio.mjs`, a stdio bridge to
   the app's `POST /mcp`.
3. **Events stream back** — the agent's words, the files it reads and writes,
   the tools it calls — to the window (the Jobs panel and a notebook's
   Details) and into the run record.
4. **A gate** stops the run when a skill needs the creator: the skill writes
   `motion/gate.json` and exits; the app asks (`gate-dialog.ts`) and runs it
   again with the answer. `STUDIO_GATE_AUTO_ANSWER` answers for headless runs.
5. **The record** — `studio_build_runs` and its stage checkpoints — is written
   before the run's side effects and updated as it goes, so a restart knows
   what finished, what is stale and where to resume.

## What a skill may do

The contract is in [`apps/studio-desktop/skills/README.md`](../../apps/studio-desktop/skills/README.md):
read files, write files, run a command under its `scripts/`, call an MCP tool
by name, and stop at a gate. Every artefact has one owner, and artefact
shapes are JSON Schemas in `packages/markdown-composition/src/schemas/`
(checked by the `validate` tool). A skill carries no agent code.

## The studio's MCP tools

Served by the desktop main process (`src/mcp/`): the motion helpers
(`atomize`, `measure`, `plan_beats`, `resolve`, `validate`, `receipt`,
`frames`), planning (`plan_context`, `plan_submit_brief`,
`plan_submit_treatment`, `plan_submit_sketch`, `plan_assets`, …), production
(`produce_context`, `produce_assets`, `produce_submit_scene`) and the older
explainer build (`explainer_*`). A submission is checked before it is
accepted; a refusal says why, and the run may try again within its budget.

## When a run fails

`provider-errors.ts` sorts a failure by what the creator can do about it —
`quota`, `auth`, `model`, `rate-limit`, `network`, `unavailable`,
`interrupted` or `other` — keeping the provider's own message, and offers the
recovery in that order (restore credits, sign in, choose another model or
harness, retry). A quota or sign-in failure is never retried by itself.
`yarn studio:doctor` reads each harness's last recorded run to say whether it
last worked; it never calls a model.

## Adding or changing a harness

An adapter implements `available()` (a version probe), the run command, and
the parsing of the CLI's event stream into the studio's events
(`types.ts`). `STUDIO_HARNESS_E2E` (a path to a JSON scenario) runs one
headless harness scenario instead of opening a window, and `STUDIO_CLAUDE_BIN`
names a `claude` binary the usual places miss. `scripts/harness-e2e.mjs`
drives the protocol with a stub CLI;
`scripts/harness-models-check.mjs` checks how model lists are read. A live
run with a real CLI is a separate, explicit proof (`scripts/kimi-e2e.mjs`),
never part of the ordinary checks.
