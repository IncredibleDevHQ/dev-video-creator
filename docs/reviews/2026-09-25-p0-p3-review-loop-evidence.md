# P0–P3 visual review loop: live acceptance evidence

25 September 2026 · `claude/scene-review-loop` · the first next-stage milestone of the [scene creative review and production plan](../plans/scene-creative-review-and-production.md)

**The visual review loop runs end to end on the creator's real local harness, and nothing downstream starts.** Claude Code 2.1.280 on Claude Opus 5.5 did every step:

- read a Stripe article and planned its story;
- designed seven rich pages;
- prepared the video's explanation brief;
- planned two scenes from their complete packets;
- revised one from creator direction, which the creator compared with the first revision;
- sketched that revision as a rough Hyperframes preview that plays and seeks on the Studio stage.

The creator approved that scene, left the other as a candidate, and both came back intact after a restart. The run's checks passed 46 of 48. The two failures were races in the driver script, and captures taken at the same moment show the product was right both times.

The run also exposed three product defects:

- the stage left view while a creator read a scene's review;
- a sketch could not draw artwork its plan reused from other pages;
- the sketch check warned about placeholders the harness had in fact named.

All three are fixed, tested and committed. A follow-up pass on the same store confirmed the first two with one more real sketch, and the third was confirmed against both real sketches.

Captures are in [`2026-09-25-p0-p3-review-loop-evidence/captures`](2026-09-25-p0-p3-review-loop-evidence/captures/) and are cited below by number. The folder's [README](2026-09-25-p0-p3-review-loop-evidence/README.md) lists everything else.

## What was run

| | |
|---|---|
| Source | Stripe, "Scaling your API with rate limiters" (stripe.com/blog/rate-limiters), read through **From a link**: 1,963 words and 8 headings, retained as `src-e261ebcb35a05969`. The theme is the page's own "stripe.com Night" direction |
| Base notebook | The story was planned by `story-master` in 2 min 37 s: 7 scenes, 2:06 against a 2:00 target. **Design the pages** was offered as the primary action, as P0 made it, and `page-master` designed and checked all 7 pages in 16 min 16 s. Every scene records `designed · Claude Code · Claude Opus 5.5`. Base `9d4f9b4e…` |
| Video | Made with **Create video** in the library: `video-6ac46d89-16e6-4de1-9d1e-744f52c89237`. Its brief started preparing as it opened |
| Harness | Claude Code 2.1.280, the desktop app's bundled CLI and the newest one found, on `claude-opus-5-5`. That model was set once as the durable default. Every run requested it, and Claude Code's own stream reported it (`model` = `reported_model` on every run record). Every planning packet's `RUN.json` says the harness inspects images natively |
| Store | Local PostgreSQL 17 and MinIO in dedicated containers: database `acceptance_p0p3` on 127.0.0.1:55437 and bucket `acceptance-p0p3` on 127.0.0.1:59137. Both were fresh for this run. The development database was never used |
| App | The built desktop app with test hooks on, for scripted clicks (`POST /__eval`) and window captures (`GET /__capture`). The live run used this branch at `764e79f1`. The follow-up pass used `48c85161` + `8d1fc560` (two of the fixes below). The driver is [`apps/studio-desktop/scripts/live-review-loop.mjs`](../../apps/studio-desktop/scripts/live-review-loop.mjs) |

Every action went through the product's own buttons, fields and dialogs. The script never supplied a plan, a page, a sketch or a record.

## Acceptance by criterion

### 1. One rich base page and its extracted cast are visible in a video scene's notebook block

Met (captures 04, 06, 07).

- All seven pages are designed pages, not schematic drafts. The token bucket page draws the bucket and its tokens, the drip, the incoming request, the empty-bucket rejection and the Redis store.
- The visual cast has 30 entries lifted from the seven pages, and all 30 were verified against the page they came from.
- The token bucket's notebook block shows its designed page, and its review strip shows six cast thumbnails. When the scene is selected, the page is the stage's labelled reference.

### 2. A real local harness creates a creative plan from the complete packet and can revise it from creator feedback

Met (captures 05, 08, 15).

- **The brief.** It came back in 3 min 24 s with 10 units, 10 entities and 58 evidence items. Its message: "Stripe keeps its API available by combining per-user rate limiters with system-wide load shedders, enforcing limits with a token bucket in Redis and launching each limiter safely".
- **Two plans, in parallel.** The token bucket and the title scene were planned in about 4 min each.
- **Token bucket r1.** It asks "How is a per-user limit actually enforced?" in 6 moments. Its cast decisions: reuse ×6, adapt, native, omit ×2. Several of the reused items were drawn on the "Limit each user" page, not on the scene's own page.
- **The direction.** "Let a burst drain the bucket until a request is refused, then hold on the steady refill before the narration names the rate."
- **r2.** It came back in 5 min 44 s with 7 moments: Open the limiter, One request, one token, **A burst drains it**, **Refused**, **Hold on the refill**, **Name the rate**, Every bucket, in Redis.
- **The comparison.** Comparing r2 with r1 finds 55 differences in nine groups. For example, the demonstration becomes: "A burst of B, C and D arrives before any refill lands: B and C take the last two and D is refused with a 429. During a held beat, two drops refill the bucket."

### 3. A rough coded preview shows the intended progression on the Studio stage, with asset and timing limitations made clear

Met (captures 16, 17, and 09 for the defect found on the way).

- **What the sketch is.** **Preview plan** started a `Sketch Scene` run. Its result is a standalone Hyperframes 0.7.106 composition: 24 s, 7 moments, 18 layers.
- **Checked twice.** The product's checks accepted it, and so did the pinned engine's lint.
- **On the stage.** It plays and seeks through the Hyperframes player. Both the stage's own timeline and the moments in the review seek it.
- **Labelled.** The stage reads "Rough sketch of plan r2 · timing estimated · presenter stand-in · placeholder artwork".
- **In the review.** A read-only timeline lists every layer, with placeholders hatched. The provisional list says what the sketch cannot show yet: estimated timing, the presenter stand-in, adapted artwork that does not exist yet, and a MotionPath technique left for construction.
- **Nothing else moved.** The only run the preview started was the sketch.

### 4. The creator compares and approves a scene independently, leaves another unapproved, and both survive a restart

Met (captures 11, 12, 13, 15).

- **Approve plan** on r2 pinned it with what it was made from: the brief, the brief's fingerprint, the visual cast and the plan's fingerprint.
- The title scene stayed candidate r1.
- After a restart, the blocks read **Plan: Approved r2** and **Plan: Candidate r1**. The token bucket still offers its approved revision beside r1, and its preview is still current.

### 5. A recording guide explains the human contribution; no take is needed to plan or sketch

Met (capture 10).

- The guide gives the scene's purpose and six lines to record (draft wording, "you may say it your way").
- It says where the speaker is in each of the seven moments: "Off screen — keep speaking; the graphics take the frame while your voice continues".
- It states "No take is needed to plan or to preview the scene". The strip reads "Recording: guide ready · no take yet" beside "Preview: ready".

### 6. Approving a plan starts no artwork generation, take selection, production or export

Met (capture 11).

- Approving started no run.
- **Produce scene…** is a separate action. It lists what it needs (an approved plan ✓, a delivery choice ✗) and says "Approving a plan never starts it".
- Across the whole run there were 8 harness runs: story, pages, brief, three plans and two sketches.
- The store has no takes, take selections, recorded blocks, generated artwork, audio, video or exports. Its only objects are the source snapshot, two brand logos, planning packets and records, and the visual cast.

## Timeline

Times are IST, from the durable run and planning records.

| Time | What the creator did | Run | Result |
|---|---|---|---|
| 02:02 | Chose Claude Code · Claude Opus 5.5 as the durable default; read the article | — | Read in 16 s (01) |
| 02:03 | **Outline it** with a 2:00 target | `run-mufzo44v` story-master | 7 scenes in 2 min 37 s (02) |
| 02:05 | **Design the pages** | `run-mufzrldu` page-master | The first page arrived at 6 min 38 s, the rest one every one to two minutes; all 7 checked at 16 min 16 s (03, 04) |
| 02:22 | **Open the designed notebook**, then **Create video** in the library | `run-mug0cpjk` brief | Ready in 3 min 24 s (05); the cast was extracted and verified, 30 of 30 (06) |
| 02:25 | **Plan the scene** on the token bucket and on the title scene | `run-mug0h0lg`, `run-mug0h3sg` | Both candidates in about 4 min (07, 08) |
| 02:29 | Wrote the direction; **Revise the plan** | `run-mug0mf0l` | r2 in 5 min 44 s |
| 02:35 | **Preview plan** | `run-mug0tl1n` sketch | Accepted in 6 min 37 s; played and sought on the stage |
| 02:42 | **Approve plan** on r2; opened the recording guide and **Produce scene…** | — | Pinned; no run started (10, 11) |
| 02:42 | Quit and relaunched the app | — | Both scenes as they were left (12, 13) |
| 02:49 | Follow-up on the fixed build: reviewed, compared, **Sketch it again** | `run-mug1cjqp` sketch | Accepted in 6 min 29 s, with every piece of reused cast in its packet (14–17) |

The live run took 39.8 min end to end, and the follow-up 6.9 min.

## What the run found, and what changed

**1. The stage left view during review** (P2, fixed in `48c85161`). The live canvas sits beside the top of the selected block. Once a creator scrolls down into a scene's review, the stage is off-screen. A selected moment then highlights the page where no one can see it, and the sketch plays out of view (capture 09). The mode switch and its note were also drawn over the page's title and bottom row (capture 07).

- While a scene's review is open, the canvas now follows the scroll beside it, stopping at the review's end.
- The mode switch and the note moved to a bar under the frame.
- `scene-review-check` now scrolls to the end of the review and asserts the stage is still in view with nothing over the page.
- Captures 14–17 show the fix: the stage stays beside the moments, the comparison and the preview.

**2. A sketch could not draw cast its plan reused from other pages** (P1/P3, fixed in `8d1fc560`). Plan r2 reuses the rate limiter glyph, the user chip and the 429 badge by library key. Those were drawn on the "Limit each user" page, and the sketch packet carried only the scene's own page's cast. So the first sketch drew those three as native stand-ins and said why: "their library artwork … is not in this packet" (capture 11).

- A packet now also carries every entry its plan reuses, adapts or enriches, with SVG, preview and parts.
- In the follow-up, the sketch packet carried all 7 wanted entries.
- The second sketch copies 7 cast SVGs instead of 4. None of its layers stands in for missing artwork. Its remaining placeholders are adaptations that only production can make, such as the re-rigged bucket, and they are labelled.

**3. The sketch check warned about placeholders the harness had named** (P3, fixed in `8c9f7dea`). Both sketches named every placeholder in their provisional lists, in their own words. The check wanted the layer's full label or placeholder text word for word, so it warned 5 and 8 times on the two sketches.

- A line now counts as naming a layer if it says the layer's id, shares two of its words, or names what the label's lead phrase ends on.
- Run against both real sketches, the check gives no false warnings. A placeholder that no line mentions still warns (unit test).

**4. Two races in the driver, not the product.**

- The first check of **Design the pages** ran before the harness list resolved. Capture 02, taken 1.2 s later, shows the button as the primary action, with the hint naming Claude Code · Claude Opus 5.5.
- The compare step ran before the review redrew with r2. The follow-up shows the 55 differences (capture 15).
- The driver now waits for both.

## Observations left open

- **Sketches are rough by design.** Adapted artwork is redrawn in the sketch and labelled as such; the real adaptation is P4 production work. The planner reported construction risks, all P4 work: recipes and techniques "catalogued but not yet proven in the installed runtime", such as `card-morph-anchor` and GSAP MotionPath.
- **Seams stay provisional.** Both plans proposed an outgoing seam their neighbour has not promised, so the seam stays provisional and the product warns about it, as designed.
- **Interrupted runs read as errors.** The follow-up quit the app a moment after its sketch was accepted, while Claude Code was still exiting. On the next start, that run reads "The app closed while this run was working" (interrupted, Retry), and its accepted preview stands. That is correct, but the runs list could say the result was kept.
- **The guide's lines lag the revision.** The recording guide's lines are the scene's draft script (six lines), while r2 has seven moments. The guide places the speaker per moment but does not re-cut the lines to the revised plan. That is fine for the lightweight guide; it is a note for P5.
- **Odd dialogue labels.** Dialogue anchors in scene blocks show atomizer names such as "Redis store Shape Shape Shape". This comes from the older dialogue-and-motion binding, not P0–P3.

## Verification of the fixes

- **Unit tests.** 245 pass on the local store (27 files). The planning service, visual cast, harness preference and appearance library suites also pass on the isolated PostgreSQL and MinIO (30 of 30).
- **In-app checks on the rebuilt app:**
  - `scene-review-check`: 28 of 28, including the new stage-follow check.
  - `plan-preview-check`: 24 of 24, run before and after the third fix.
  - `planning-check`: 53 of 53.
  - `visual-cast-check`: 10 of 10.
- **Follow-up pass on the acceptance store: 14 of 14.** The stage stays in view beside the moments, the comparison and the preview. Comparing r2 with r1 finds 55 differences. The new sketch was accepted with no cast missing. The approval and the candidate are intact, and the only new run is the sketch.
- **Relaunch.** A relaunch after the follow-up settled the cut-off run as interrupted and kept its preview.

## Repeating it

The driver spends model budget: about 40 minutes of the chosen harness end to end. It uses the local file store unless told otherwise. It refuses PostgreSQL without an explicit `STUDIO_DATABASE_URL`, because the default is the development database.

```bash
LIVE_DATA_DIR=/tmp/live/data LIVE_EVIDENCE_DIR=/tmp/live/evidence node apps/studio-desktop/scripts/live-review-loop.mjs
```

`LIVE_HARNESS`, `LIVE_MODEL`, `LIVE_SOURCE_URL` and `LIVE_TARGET` choose the harness, model, article and length. `LIVE_BASE_ID` or `LIVE_VIDEO_ID` resumes after the costly steps.
