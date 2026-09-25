# PR #16 fresh end-to-end review: what was fixed, and how it is proven

This responds to [the fresh Anthropic blog end-to-end review](./2026-09-25-anthropic-fresh-e2e-review.md) of PR #16 at `21c28a81`. That review is commit `7dbcd4e6` on `feat/hyperframes-markdown-mvp`, committed locally and not yet pushed.

Every finding, F1 to F7, is fixed on `claude/scene-review-loop`. Each fix is one verified commit, made in the review's repair order:

1. the export route (F6);
2. the handoffs (F1, F4, F5);
3. the path to useful review (F2, F3, F7).

The proofs are unit tests and scripted checks in the desktop app. The app checks use stub harnesses on a throwaway store. No page, plan, sketch or video was written by hand in the harness's place.

## Findings

| | Finding | Commit | Proven by |
| --- | --- | --- | --- |
| F6 | Publish traps a multi-scene video fork before export | `78ba4727` | `scene-review-check`: a two-scene fork goes from the selected scene through Publish to a draft MP4 |
| F1 | Schematic number pages turn percentile labels into false values | `e51c9e85` | `server/source.test.ts` |
| F5 | Presenter coaching gives a mathematically false reason | `ecc52239` | `director.test.ts` |
| F4 | "Presentation idea" displays automatic layout advice | `19386697` | `page-objective.test.ts`, `planning-service.test.ts`, `planning.test.ts`; `planning-check` (the Presentation brief in the app) |
| F3 | The base notebook's Plan video action leads to a dead end | `fd9c48df` | `planning-check`: a base with no video, planned from its second page |
| F7 | The selected video plan is still below the main review viewport | `f1e7d494` | `scene-review-check`: the scene picked from the rail in the 1440 × 900 window |
| F2 | Reviewing completed pages requires stopping unfinished design | `3a259b52`, `880e1e97` | `page-design.test.ts`, `derive.test.ts`; `source-design-check`; a browser view of a notebook still being designed |

## What changed, finding by finding

**F6. Publish reaches its export again.** Publishing a video notebook of two or more scenes now puts the notebook's own composition on the stage. The scene review's stage steps aside, so the junction walk and its Continue → are no longer hidden. The stage returns when the summary closes.

The summary and the Publish button's tooltip say what the export is: the notebook's own pages, words and takes, not the approved scene plans, which are not produced yet.

`scene-review-check` runs the review's route, with a selected scene on the stage:

1. Publish, which shows Junction 1 of 1 and Continue →;
2. the summary, which states the boundary;
3. Start publish, which gives a draft MP4 served as `video/mp4` (295,571 bytes);
4. the stage, back beside the notebook.

The route has **two video scenes**, so it takes the branch the review found broken; a one-scene export would skip it. The check ran 51 of 51.

**F1. A number in a name is a label.** The schematic renderer used to take the first number in a stat's label as its value. It now uses a figure only in two cases:

- the label leads with the figure, as in `99.9% uptime`, `~60% lower` or `1,200 requests a second`;
- the figure stands alone with a unit, as in `Uptime 99.9%` or `40 ms`.

Numbers inside names, such as `p50`, `v2`, `GPT-4`, `H100`, `Claude 3.5` and `S3`, are labels, and so are bare years. A stat without a leading figure renders its label and detail as written. The tests cover percentiles, versions, model and product names, and years. They also render the review's `p50 TTFT` / `p95 TTFT` page: no `50` or `95`, no `pTTFT`, and both details present.

**F5. Coaching says the rule that decided.** The director now returns an `areaReason` with the area. It records:

- the rule: a script direction, the page's kind, a table, a traced flow, a camera move, a dense beat, or text under the gate at a narrower width;
- the beat that decided it;
- the smallest text at the chosen width, and whose text that is;
- the gate.

The notes are written from that record alone. A width is called too narrow only with the measure that fails there. For the traced diagram in the tests, the note was:

> The diagram needs the whole frame — you become a chip (in a panel the smallest text would be 21.1 px, under the 18 px gate).

It is now:

> The diagram traces 3 connections (beat 2), and a traced flow needs the whole frame — you become a chip.

A page whose text fails even at full frame says so with both measures, and names the text to enlarge. The record is kept with the director's output on the scene (`directorAuto.areaReason`).

**F4. The teaching objective survives the director.** A source page was handed its idea as its first director notes. Animating the page rewrote those notes, and the pinned presentation record preferred them over the outline. The outline could not be read either: a base's outline scenes never recorded which page each became.

A page's teaching objective is now read from the source outline. It is found by the page's id, by the base page a video scene came from, or by title for older outlines. If none of those match, a page made from an outline falls back to the first notes the director kept as its seed. New bases record each outline scene's page.

The director's notes are kept apart as layout guidance:

- the Presentation brief shows **Teaching objective**, and the staging under a collapsed **Previous layout guidance**;
- packets carry the objective on its own line, and keep the staging as the "Page notes (slide layout, reference only)" the planning skill already treats as reference;
- the explainer build and the video plan's neighbour hints take the objective, never generated staging, as a page's idea.

The skills are unchanged, so existing briefs and plans stay fresh. Tests give a page the exact shape animation leaves: the seed, `directorAuto`, and generated notes. The objective holds before and after. `planning-check` sees it in the app, and sees the staging collapsed and never called the idea.

**F3. Plan video makes the fork.** On a base without a video, Plan video now offers **Create video fork and prepare brief** ([capture](./2026-09-25-anthropic-fresh-e2e-response-evidence/f3-fork-offer.png)). It is the library's own lineage-safe fork, made from the base as it is in the editor. The new video opens its plans on the scene that was selected in the base, and prepares its explanation brief where a harness can ([capture](./2026-09-25-anthropic-fresh-e2e-response-evidence/f3-fork-opens-on-chosen-scene.png)). In a browser, it says the brief is prepared in the desktop app. When a fork cannot be made, for example because the base has no pages yet, it says why, and offers All notebooks → Create video.

`planning-check` makes a base with no video and asks for its plan from the second page. The fork opens on "Second idea" with brief r1 ready, and the base is unchanged.

**F7. The plan leads.** In a video notebook, the selected scene's review now sits above its block. It has one header: the title, one status line, the revisions and the actions. The status line covers the plan, recording, preview and output, with the page's artwork. The question, the takeaway and the moments follow, beside the stage. Before a plan exists, the review shows what the scene's pages were made to teach.

The block's inherited dialogue folds to one line, **Edit source dialogue**, which unfolds the dialogue and its editor in place. Selecting from the rail, or returning from the planning workspace, brings the review into view from its top, and the stage lines up with it. Base notebooks are unchanged.

`scene-review-check` repeats the review's step: another scene is selected, then this one is picked from the rail in the 1440 × 900 window. Without scrolling, the check sees:

- the title and status line;
- the question and the first moment;
- the revision;
- preview and approve;
- the stage.

Nothing inherited stands before them ([capture](./2026-09-25-anthropic-fresh-e2e-response-evidence/f7-first-screen-1440x900.png)). The check also unfolds and folds the source dialogue.

**F2. Opening the notebook keeps designing.** Every page in the wizard now opens large, with previous and next ([capture](./2026-09-25-anthropic-fresh-e2e-response-evidence/f2-page-inspector.png)). Each page says what it is ([capture](./2026-09-25-anthropic-fresh-e2e-response-evidence/f2-page-states.png)):

- designed;
- being checked;
- still being designed;
- failed the page check;
- a schematic draft.

"Open now — 1 designed, 1 still designing" and "Stop remaining work" are separate actions. Opening no longer stops the designer. Each scene opened before its page was finished carries the run and page it waits for, bound to the page it shows as the notebook keeps it. When the run's page passes the page check, it lands on that scene, and the scene's motion is planned again from its words. A page the run redraws while checking lands too.

A scene changed meanwhile keeps its change. The binding lives on the scene, so a reload resumes it. A video fork is the base as it was: it never takes those pages, and hears of them as base changes.

The notebook says what is still being designed, with Stop remaining work, and keeps saying so while scrolled ([capture](./2026-09-25-anthropic-fresh-e2e-response-evidence/f2-notebook-still-designing.png)). Once the run ends, nothing waits any more ([capture](./2026-09-25-anthropic-fresh-e2e-response-evidence/f2-page-landed.png)). A browser cannot follow the desktop app's run. It says the page lands on its scene while the notebook is open in the desktop app, and offers no Stop.

`source-design-check` exercises all of it:

- it inspects pages while the run works;
- it opens early and sees the run keep running;
- the second page lands on its scene, and the run finishes;
- on a second deck, it stops the remaining work from the notebook.

## Verification

- **Unit suites:** studio-v2 has 281 tests, and markdown-composition has 100.
- **Desktop checks for these fixes**, each against a throwaway store:
  - `scene-review-check` 51/51;
  - `planning-check` 65/65;
  - `source-design-check` 44/44.
- **Release suite** (`release-check.mjs`, run on `3a259b52` against an isolated store): 50 of 51 pass. The one failure is `skill-references-check`: the same 132 unresolved links inside the vendored Hyperframes skill bundle as before this work.
- **After the suite:** the browser wording in `880e1e97` was checked in a browser against a throwaway app, and `source-design-check` ran again on the final build.

## What this does not do

- **Approved-plan production is still not implemented.** It is repair-order item 4. The draft export states that it exports the notebook's composition, not the approved plans.
- **F1's structured metric fields are not introduced.** The review names `value`, `unit`, `label`, `qualifier` and evidence. This fix renders faithfully until they exist.
- **F2 does not create a durable draft notebook when design starts.** Durability begins when the creator opens the notebook: from then on, each scene's binding is stored with it. Before that, the wizard follows the run in memory, as it did before. The run itself continues, and its pages remain in its run directory.
- **F4 keeps the latest staging in `directorNotes`, apart from the objective.** That is what the base notebook's Director text shows. The automatic record is `directorAuto`.

## Notes for review

- The app must be restarted to use this build. An app started before these commits serves the earlier code.
- The review commit `7dbcd4e6`, and the earlier review `4d36edb1`, are still local-only on `feat/hyperframes-markdown-mvp`. The link to the review above resolves once that branch is pushed.
