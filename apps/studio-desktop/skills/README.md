# Skills for Incredible Studio

Routed skills in the ppt-master sense: an entry file, a routing table, runtime authorities with gates, references sliced from *The Motion Decision Core*, templates, and a token-budget manifest. They contain no agent code; the host harness (Claude Code, Codex, Kimi) reads them, and the studio serves the helpers as MCP tools.

| Skill | Job |
|---|---|
| `motion-master/` | beats, heroes, attribution, actions, timing → a validated resolved plan (Parts I–III) |
| `stage-director/` | presenter layouts, overlays, reframes, speech timing, the director's suggestions, offers, ratings and guidance (Parts II, V) |
| `speaker-crew/` | profile for 2–4 speakers, collaboration patterns, the gallery rules (Part III, §26, §29) |
| `video-producer/` | frame-exact publish, captions, alpha overlays, review sheets |
| `page-master/` | how to vendor and adapt ppt-master for page creation |

## Install

- **Claude Code**: copy the folders into `.claude/skills/` of the project (or `~/.claude/skills/`); the frontmatter `description` triggers them. Automation: run through the Agent SDK / `claude -p --output-format stream-json` with the project directory pre-approved and the studio MCP server configured.
- **Codex CLI**: add to the project `AGENTS.md`: "Before any motion, stage, speaker or publish task read `skills/<name>/SKILL.md`"; run with `codex exec --json`; MCP server in the Codex config.
- **Kimi CLI**: same `AGENTS.md` pointer; agent mode with the MCP server enabled.

## The harness contract

A skill may only: read files, write files, run a command under `scripts/`, call an MCP tool by name, and stop at a `⛔ BLOCKING` gate by writing `motion/gate.json` and exiting. The app shows the gate as a dialog and re-runs the skill with the answer. Every artefact has one owner (`motion/brief.md`, `motion/lock.md`, `motion/resolved.json`, `motion/receipt.json`, `motion/track.json`, `takes/<id>/…`). Versions of harness, model and skill are recorded in `motion/run.json`.

## Vocabulary

One meaning per term across all skills: beat, hero, unit, primitive, operation, template, brief, lock, resolved, receipt, clock, family, slot, treatment, free region, tile, turn, take, offer, escape hatch.
