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

Research reports progress and then renders the validated final answer; it does not stream response tokens. Saved note blocks are append-only to retain provenance. Existing standalone notebooks are not automatically migrated into projects. The initial project validation exercised Claude Code live. The named-chat validation below additionally exercises Kimi and records a Codex runtime failure. Repository context reads committed revisions, not uncommitted working-tree changes.


## Named chats and human–AI collaboration

Each project now has saved, named chats with independent repository/branch context and agent/model defaults. New chat creates a durable session before its first question. The first question in a new project can still create its chat automatically. Existing research roots become stable chat records on read; subsequent normal saves persist that upgrade without changing notes or answer provenance.

The implementation adapts Macro's session identity, context controls, and stable workspace panes (local references: `docs/AGENT_GUIDE/ai-chat.md` and `apps/web/src/lib/split-router/README.md` in the sibling Macro repository). The creator directs research, chooses the next agent, selects evidence to keep, and moves the resulting project knowledge into content production. Agent selection can change within a chat. Every answer retains the agent and exact repository commits that produced it.

- Chat URLs, independent drafts, current branch positions, repository choices and agent defaults survive the relevant navigation paths. Reload restores the URL's chat/question and saved configuration; unsent drafts persist in session storage.
- Backtracking does not replace the chat's next-answer agent with the historical answer's agent. Cross-chat parent injection is rejected.
- Separate chats can run independently; a chat allows one live answer at a time. Stop and retry retain earlier answers.
- Repository controls open above the composer and preserve its draft. Up to four repository/branch pairs are supported.
- The workspace explicitly connects Research → Keep notes → Create a series. Saved excerpts scroll into view and retain their source link.
- Mobile prioritizes chat, with an expandable graph. The 390px layout has no horizontal overflow.

### Live browser evidence

Testing used the visible parallel stack on 4291/4391 and disposable project data, with no changes to the stack on 4187.

1. Created **From research to a YouTube series** and linked Macro's `main` branch plus this worktree's `codex/projects-research` branch. Claude Code completed a real comparison with citations from both repositories.
2. Selected Codex for a follow-up within the same chat. Its CLI exited with code 1 before producing events. The failed turn remained in the graph. **Ask again** with Claude Code recovered the question and produced the series outline. This is not evidence of successful live Codex generation.
3. Created **Episode framing** with Kimi and no repositories. Confirmed that its independent draft and agent choice survived chat switching and reload. Kimi completed a real answer using the shared project notes.
4. Switched that same chat to Claude Code and completed a follow-up using Kimi's answer. Saved the resulting viewer promise into **Series outline** and verified **View source** returns to its chat and question.
5. Saved the repository-based outline into a new notebook, verified both notebooks remain available and the shared canvas includes the new notebook, and started real wireframe generation from the saved outline. At the recorded check, seven wireframes were visible and generation was still progressing. No new finished video or YouTube upload is claimed.
6. Rechecked desktop and mobile layouts, agent-name legibility, repository controls, and the saved-note handoff.

Final checks: 230 test files / 1,504 tests passed. After the final composer/layout adjustments, the 19 focused research tests, TypeScript, production build, formatting and source-size checks passed. Disposable PostgreSQL/S3 storage checks passed. Sandbox-only failures to start local fixture servers, browsers, and Docker were resolved by running those checks with the required local process access.

![Named chat, branching research and saved answer](projects-research-evidence/project-chat-collaboration.png)

![Independent repositories and branches in a chat](projects-research-evidence/project-chat-repositories.png)

![Mobile chat and research workspace](projects-research-evidence/project-chat-mobile.png)
