# The scene workspace, run live

This is the completion evidence asked for in §10 of [the scene workspace plan](../../plans/video-scene-workspace-ui.md). The run followed U1–U6 on `claude/scene-review-loop` (PR #16).

`apps/studio-desktop/scripts/live-workspace-run.mjs` drove it through the product.
- **Harness:** the creator's local Claude Code 2.1.280 with Claude Opus 5.5, for every stage. The run cleared the per-stage choices an earlier session had left.
- **Store:** an isolated local PostgreSQL and MinIO.
- **Source:** [SQLite — Write-Ahead Logging](https://sqlite.org/wal.html), with no brand website. The reader took the first 24,000 characters: 3,923 words and 19 headings.
- **Theme:** "Ledger", saved in an earlier session.

[`evidence.json`](./evidence.json) keeps every check, stage timing, milestone, refusal and note. Local paths in it are shortened to `~`.

The run spent real model budget, in four sessions. Its stages are resumable, so each session carried on from the last, and a stage already done was never run again. Across the sessions 48 of 49 checks passed. The one that failed found a bug, which was fixed and proved again. There were 16 harness runs, all Claude Code. Two of them the script did not ask for: a plan and a preview of scene 6, started in the app while the run was waiting.

## The path, in the workspace

| Step | What happened | Capture |
| --- | --- | --- |
| Import | The article was read with no brand website. For a link, the brand step opens on the article site's own colours; the theme saved earlier was one tab away, bound and named on the continuation action: "Outline it with “Ledger”". | 01 |
| Story | The harness outlined six scenes, from "Write-Ahead Logging" to "One Line to Switch". | 02 |
| Designed base | The harness designed all six pages, in the Ledger theme (15 minutes). | 03 |
| Video | The base's next step made the video, which opened on its scenes. "Checkpointing" is presented by the creator and "Readers Keep Reading" is spoken by a generated voice. | 04 |
| Brief | The harness prepared the explanation brief. | — |
| Plan r1 | The plan developed in the phases the product confirmed: the run started, read its packet, published its explanation, then five moments, handed the plan in, and was accepted. The explanation and moments showed as "Draft · still being checked" while it worked. | 05 |
| A provider failure | A model id the provider refuses, then the retry. The failure kept the provider's own words ("There's an issue with the selected model (claude-opus-0-0)…"), the recovery, **Plan the scene again** and **Change the harness or model**. With the model restored, the retry planned the scene. | 06 |
| Direction, r2 | Direction for the checkpoint was typed in Story, and the harness planned r2 from it, again in its phases. | 07 |
| Preview, reopened midway | The preview of r2 built under the stage, which kept the designed slide. The app was reopened midway. | 08 |
| — the first time | The workspace came back on scene 1, not the scene being waited on, so the ready preview was only offered in the rail. That was a bug (below). | 09 |
| — after the fix | On a third scene, "The Inversion", the workspace came back to that scene, and the ready preview took the stage by itself, announced as "Preview r1 ready". | 10 |
| A chosen reference | With the page chosen while a preview built, the ready preview was offered under the stage, not forced. | 11 |
| An older revision, late | r1's preview, asked for after r2's was on the stage, finished later. It was kept as history; the stage kept r2's. | — |
| A moment | A moment opened with what is on screen and what is said. The timeline read the scene on its sketch's clock, with the layers the sketch declared. | 12, 13 |
| Approval | Approving each scene started nothing. | — |
| Recording | Recording opened beside the stage, in place of the inspector. The takes are listed with the one used. | 14, 15 |
| Two takes refused | The first take was read from a teleprompter that still showed the older words (a bug, below). Producing it was refused: "moment m5: the take does not say “When that read ends, the checkpoint picks up where it stopped.”" The second take read the lines back to back and was refused: "moment m6 has no words, and the take leaves 0.343s for it — leave a pause for it in your take". The third left the pause. | — |
| The presented scene | Produced on the take's clock (22.6 s) after one repair, played and checked. Its timeline reads "On the clock of your take · … 5 timings can be adjusted in Output". Accepted and rendered. | 16, 17 |
| The voiced scene | Produced on the generated voice (23.3 s) after one repair. Its timeline reads "On the clock of the generated voice". Accepted and rendered. | 18 |
| Export | Publish called it a draft: two of six scenes play their accepted productions, and the rest are the notebook's own composition. The two produced scenes were exported: 46.0 s at 1920 × 1080, H.264 with AAC. Sound runs through it, with 4 quiet seconds out of 46, measured one second at a time. | 19, 20 |

## What the run found, and what was fixed

Each fix is its own commit on the PR, with a check that now covers it.

| Commit | What the run found |
| --- | --- |
| `48925cea` | The desktop app could not read a source on a distant host: sqlite.org failed with "fetch failed". Electron's Node 24 gives each address 250 ms to connect, so each attempt now gets 2.5 s. |
| `f3bb9605` | Claude Code's "issue with the selected model" read as "other", so the recovery did not offer another model. It now reads as a model failure. |
| `6e0c0f87` | Reopened while a preview was built, the workspace came back on the first scene. Reading the plans settled the waits and drew the workspace before the scene last shown was restored. `preview-handoff-check` now reopens on the second scene. |
| `a2870ff1` | After a take was kept, producing stayed disabled ("Record and select a take of this scene first") until the window next took focus. A kept or chosen take now saves the notebook and reads the plans again. |
| `de57b92a` | The teleprompter showed the scene's older words just after the plan's lines became its script, while the take was committed as spoken against the new ones. It read the compiled scene list, which lags an edit; it now reads the notebook, as the take's lineage does. |

## What remains provisional

- **The presented take is synthesized.** It is speech from the system voice over a painted picture. It was committed through the product's take archive exactly as a kept camera take is after upload, but the camera and microphone capture were not exercised. Where the plan puts the presenter beside the graphics, the export shows that painted picture.
- **The generated voice is the local system voice**, as no voice provider key was set.
- **Nobody watched the export.** It was judged by eight frames across it and its loudness second by second. The frames show both mechanisms at work: the reader holding its end mark while the writer appends, and the checkpoint copying pages into the database file.
- **The presented scene names two gaps of its own.**
  - The library's writer glyph was not in its packet, so the writer is drawn as an ink caret.
  - On the take, moment 4's cue "long-running read" does not fall where the plan put it: rebind the cue or record a pickup.
- **Four of the six scenes were not produced**, and the export shipped only the two that were.
- **The brand step for a link.** With a link and no brand website, it opens on the article site's own colours, a choice made for F5 of the Perplexity review. The plan says "With no website, open Saved themes"; whether a link counts as a website there is a question for the plan.

## Captures

1. The brand step: the saved theme chosen and named on the continuation action.
2. The story the harness outlined.
3. The six designed pages.
4. The video on its scenes, with who speaks chosen per scene.
5. Plan r1 at two minutes: the phases, the harness's last word, and its explanation as a draft.
6. The provider failure, with the provider's words, the recovery and the ways on.
7. r2 being planned from the direction.
8. The preview being built under the stage, with the page kept.
9. Reopened before the fix: scene 1 on show, "Preview r2 ready" in the rail.
10. Reopened after the fix: the ready preview on the stage of the scene being waited on.
11. A chosen page kept, and the ready preview offered.
12. A moment in the inspector.
13. The timeline on the sketch's clock.
14. Recording beside the stage.
15. The take used, among the scene's takes.
16. The presented scene being produced, in its phases.
17. The presented scene produced on the take's clock, with its timeline and Output.
18. The voiced scene produced on the generated voice.
19. Publish, before the export.
20. Eight frames across the exported MP4.
