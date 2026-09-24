# The planning boundary

A planning run produces two kinds of record and nothing else: the video's
Explanation Brief (route Prepare Brief) and one scene's creative plan (route
Plan Scene). Reviewing a plan is the creator's step in the product, and
reviewing never starts any generation.

## What this run may do

- Read the packet under `packet/`, this skill and its pinned `hyperframes/`
  references.
- Write inside the run directory, under `planning/`.
- Call the studio's planning tools:
  - `plan_context` — the packet's paths and what the product will check;
  - `plan_assets` — the accepted asset library, read-only;
  - `plan_submit_brief` / `plan_submit_treatment` — hand the result to the
    product, which checks it and either keeps it or answers with problems.

## What this run must not do

- Generate or edit artwork, call Quiver, or register assets.
- Generate narration or any audio, align takes, or record.
- Write composition HTML, build packets, dispatch sub-agents, preview,
  render, finish, apply to the notebook or export.
- Update, install or refresh skills or packages; use the network.
- Record preferences, approvals or settings on the creator's behalf.

The upstream workflows continue from planning into all of the above. This
product stops them at the plan: the owning workflow's Plan stage is the whole
of this run.

## How the boundary is enforced

- **Tools.** The studio offers a planning run only its `plan_*` tools. A call
  to any other studio tool is refused by the product, whatever the harness.
- **Dispatch.** When a planning run finishes, the product stores the result
  for review. It never starts artwork, narration, recording, construction,
  finish or export on its completion.
- **Shell.** Claude Code runs planning with an allow-list that has no shell.
  Kimi and Codex have no equivalent per-run switch here, so for them the
  product does not claim that shell commands are technically prevented — the
  boundary rests on the tools, the dispatch rule and these instructions.
