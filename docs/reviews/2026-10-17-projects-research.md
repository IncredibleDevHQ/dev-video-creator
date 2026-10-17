# Projects and branching research

Implemented on `codex/projects-research`, based on PR 19 head `5a5954d`.

## Experience

The landing page accepts a first note without setup and creates a project with one notebook. A project contains separately named notebooks. Saved notes are durable before any AI operation. The research view combines a navigable question graph, a conversation, and a notebook capture panel. Selecting a response passage offers Save to notebook or Ask about this. Saved excerpts retain the exact source response, question, offsets, and repository commit context. View source returns to the original question. Asking about a captured excerpt branches from its source response.

Research supports the existing Claude Code, Codex, and Kimi adapters. Up to four local repository/branch pairs can be selected. Each question pins branch heads to commits and exposes read/search/diff tools at those revisions. Follow-ups receive their selected ancestors, not unrelated sibling conversations. The project notebooks are also supplied as research context.

Wireframes appear in a continuous view grouped by notebook, with a jump selector. One aggregate notebook powers the project's shared content map and existing series workflow. Subsequent notes feed that map through the durable queue, with deterministic IDs to prevent duplicate synchronization. Existing notebooks remain accessible through Earlier notebooks & studio tools.

## Validation

Visible browser tests use the isolated stack at http://127.0.0.1:4291 (engine 4391) and disposable data at `/private/tmp/incredible-projects-research`. Existing stacks were left untouched.

- Created and renamed a project; added a second notebook and notes.
- Linked two local repositories with branch choices; completed a real Claude Code answer citing both repositories.
- Selected and saved a response excerpt, followed it into a new question, and completed a real answer.
- Returned to the original question and completed a sibling branch; all paths remain visible.
- Confirmed exact excerpt text after fixing a template-whitespace offset error.
- Cancelled a real question; the stopped node and earlier answers remain after reload.
- Confirmed an unsent question survives reload.
- Checked the research layout at desktop and 390px mobile widths.
- Generated real notebook and aggregate canvas wireframes; opened the interactive shared map and verified that a subsequently captured excerpt was queued there with its notebook label.
- Started generation for the second notebook and verified the continuous view and notebook jump selector. Screenshot captures show incremental generation, not a claim that all drawing jobs had finished.
- Full suite: 228 files / 1,494 tests passed, including the stopped-state recovery regression test.
- Production build and source-size checks passed. Existing disposable PostgreSQL/S3 storage check passed.

![Research graph, response and captured excerpt](projects-research-evidence/research-branches-lineage.png)

![First-note landing page](projects-research-evidence/project-start.png)

![Continuous notebook wireframes](projects-research-evidence/continuous-wireframes.png)

![Shared canvas](projects-research-evidence/shared-canvas.png)

![Shared map receives new notebook excerpts](projects-research-evidence/shared-map-note-sync.png)

![Mobile research view](projects-research-evidence/research-mobile.png)

## Current boundaries

Research reports progress and then renders the validated final answer; it does not stream response tokens. Saved note blocks are append-only to retain provenance. Existing standalone notebooks are not automatically migrated into projects. Claude Code was exercised live; Codex and Kimi use their existing adapters but were not exercised live in this session. Repository context reads committed revisions, not uncommitted working-tree changes.
