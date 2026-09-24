# M0 creative planning: acceptance evidence

24 September 2026 · `claude/hyperframes-markdown-handover-674230` (fast-forward of `feat/hyperframes-markdown-mvp` at `e2984d85`) · planning code at `ecef1a06`

**A fresh blog reached inspectable, source-grounded creative plans through the visible workspace and the product's local harness, and nothing downstream started.** Claude Code prepared the video's Explanation Brief and planned four contrasting scenes. Every submission passed the product's checks on the first attempt. Kimi's exhausted quota exercised the failure path with a real provider three times. Refresh, restart, retry, review, compare and stale protection held. Reading the plans against the wireframes and the source exposed one real problem: the slides' layout notes were being handed to the planner as the creator's words. That was fixed, the brief was prepared again and three scenes were replanned before this review closed, as the M0 acceptance in section 12 of the [pipeline plan](../plans/hyperframes-explainer-pipeline.md) asks.

- [Evidence folder: captures, durable records, run packets and outputs](</Users/think/Downloads/Incredible Studio/reviews/2026-09-24-m0-planning/README.md>)
- [Captures](</Users/think/Downloads/Incredible Studio/reviews/2026-09-24-m0-planning/captures/>) are referenced below by number.

## What was run

| | |
|---|---|
| Source | Stripe, "Scaling your API with rate limiters" (stripe.com/blog/rate-limiters), read by the product and retained as `src-c97384e65f02df62`: 61 paragraphs, about 2,000 words |
| Base notebook | Outline by `story-master` on Claude Code (`run-mufefz4n-50d915d2`); 12 pages drawn with the studio's template; base `666100eb…` at revision `6689db6105cf7206` |
| Video | Made with **Create video** in the library: `video-dfdc86be-4b0b-4920-9010-8f6aa5e882ae`. A second fork, `video-ce341eae…`, was made later to show the base's fork selector |
| Harnesses | Claude Code 2.1.278 for every completed run. Kimi 2.0.1 with its weekly quota exhausted (the failure path). Codex not installed |
| Skills | `video-planner` 0.1.0, then 0.1.1 after the revision below; Hyperframes bundle pinned at `99221c50` |
| App | Desktop app on local persistence in a scratch data directory, with the test hooks on for scripted clicks (`POST /__eval`) and window captures (`GET /__capture`) |

The build under test was this branch's planning code applied on top of the uncommitted repairs in the main checkout. At the branch head the story run is hardwired to Kimi, and those repairs add the creation-agent choice that let Claude Code outline the blog. Every planning file carried into that tree was compared with the branch first; they were identical.

Every action went through the workspace's own buttons, selects and text boxes. The one browser confirm (**Prepare the brief again**) was answered OK by the script.

## Acceptance by criterion

| M0 criterion | Result | Evidence |
|---|---|---|
| A fresh blog reaches inspectable, source-grounded creative plans through the visible UI and the selected local harness | Met. Two accepted briefs and seven accepted plans across four scenes, all from Claude Code | captures 09, 11–14, 18, 22–26; `video-1/records` |
| Both brief views have correct lineage | Met. The video's **Presentation brief** shows what it pinned from base `6689db61`: wireframe, passages, and the page notes labelled as slide layout. **Video explanation brief** shows the brief with its source and base revisions. The base shows its video's records read-only, with a fork selector | 08, 09, 17, 20, 21 |
| A scene can combine multiple skills with a coherent reason | Met. Every plan names five skills with a reason each: `general-video` (owner), `hyperframes-creative`, `hyperframes-animation`, `motion-graphics`, and the cue-window method of `faceless-explainer`. Recipes come from the pinned catalog; looks the catalog lacks are declared `adapted` and reported as construction risks | `video-1/records/treatment-*` |
| Refresh/reopen and retry preserve the result | Met. Three app restarts and four window reloads, one with four runs in flight. The brief was retried after Kimi failed (r1 → r2), and so was a plan (s03 r2 → r3) | 03–06, 10, 15, 26 |
| Stale output cannot overwrite current work | Met. s09 r2 finished after its direction changed and was kept as `superseded`; r1 stayed current and reads stale. A new brief and the skill update marked every earlier plan stale, naming the reason. Reviewed plans were kept throughout | 17, 19, 24 |
| No downstream generation starts | Met. 14 runs in all: one `story-master` outline for the base (before the fork) and 13 `video-planner` runs. The library holds no artwork, there are no outputs, and there are no audio or video files. The video's only stored objects are 12 planning packets, 2 briefs and 8 submitted plans | `video-1/overview.json` |
| Recorded run/artifact evidence and captured UI states | Met | evidence folder |

## Timeline

All times IST. Durations are from the durable records.

| Time | What the creator did | Record · run | Outcome |
|---|---|---|---|
| 16:44 | **Create video** in the library, with Kimi as the planning harness | brief r1 · `run-muffpycm` (Kimi) | Failed in 4 s. The workspace showed what happened ("The run ended (error, exit 1) without submitting a result"), Kimi's own status (403 weekly usage limit) and how to retry (03) |
| 16:45 | Switched the harness to Claude Code, **Retry the brief** | brief r2 · `run-muffqsrp` | Ready after 8 min 9 s; first submission accepted, no warnings |
| 16:58 | Set **Start with one limiter** to *My voice / presenter*; **Generate creative plan** on four scenes | treatment r1 × 4 · `run-mufg7ibp`, `-7mm3`, `-7qvv`, `-7v6n` | Candidates in 8–10 min, each accepted on its first submission. The delivery decision marked the brief stale: "the delivery decisions changed since it was made" |
| 17:02 | Reloaded the window mid-run | — | All four scenes still **Planning**; runs continued (10) |
| 17:07 | **Mark reviewed** on s10 and s03 | — | Reviewed (11, 12) |
| 17:08 | **Regenerate** s03 on Kimi | s03 r2 · `run-mufgkzhm` | Failed in 5 s. **Reviewed r1 kept** and **Retry creative plan** offered (15) |
| 17:12 | Revised the packet and skill (0.1.1, below); restarted the app | — | The brief and every plan read stale: "the planning skills changed" (17) |
| 17:13 | **Prepare the brief again**, confirmed | brief r3 · `run-mufgr2nk` | Ready in 5 min 39 s; first submission accepted |
| 17:20 | **Regenerate with direction** on s10; **Retry** on s03; regenerate s12; regenerate s09 with a direction | s10 r2, s03 r3, s12 r2, s09 r2 | Candidates in about 8 min |
| 17:21 | While s09 ran, changed its scene direction in the workspace | — | When s09 r2 submitted, it was kept as **superseded**: "its inputs changed while it ran; the result is kept for reference but not used" (19, 24) |
| 17:21 | A second **Create video** on Kimi; opened the base's planning | video-2 brief r1 · `run-mufh1nod` | Failed on the quota. The base offers both videos, named by when each was made (20, 21) |
| 17:29 | **Compare with…** on s10, then **Mark reviewed** on r2 | — | Side-by-side with changed moments marked; r1 now reads **previously reviewed** (22, 23) |
| 17:31 | Final reload | — | Every state read back from the records (26) |

## The Explanation Brief

**r2 (Claude Code, before the revision).** 59 evidence passages, each checked verbatim against the retained source or the creator's text; 15 were attributed to the creator. 12 entities and 12 units cover all 12 base pages, and the progression marks which steps are causal. The route is `general-video`, with a reason that rules out the specialised routes. Scene boundaries, the time split, demonstrations, visual treatment, recipes and delivery stay among the open decisions. The uncertainties are specific: the source never fixes the request limiter's N, four figure captions arrived without their images, and the length averages about 30 s a unit. Nothing in the brief decides a presentation structure, and the product refused none of it.

**The problem it exposed.** Five of r2's nine creative-guidance items were marked as the creator's, and four of those came from the base pages' notes. Three quote the notes ("This is the hook: earn the next minute."). The fourth summarises them as rejecting any treatment that would push page text under 18 px, citing "in a panel the smallest text would be 11.9 px, under the 18 px gate". The presentation flow writes these notes for each slide's layout and presenter. The brief packet listed them under *What the creator wrote*, and the brief checker accepted quotes from them as creator evidence. Every r1 scene plan then planned presenter chips versus panels around an 18 px text gate. Presentation input was leaking into the video plan as a requirement. One note is also self-contradictory: s10's says the smallest text "would be 30.9 px, under the 18 px gate". That comes from the page generator, which this change does not touch.

**r3 (after `19a8db8a`).** 64 evidence passages (18 from the creator) and 12 units. Its four creator-guidance items now quote the creator's scene scripts. "18 px", "gate" and "chip" appear nowhere. It records s12's delivery decision and cites it in the route reason.

## The plans, read against the wireframes and the source

The base wireframes are static slides. s10 is five labelled boxes joined by arrows. s03 is two labelled columns over a "critical requests" band. s09 is four stat tiles. s12 is a single sentence on a card. Every plan turns its page into an explanation that develops over time, without copying the slide's layout.

**s10 · Token bucket in Redis (mechanism).** r1 builds the scene "as before / action / after on a single object": one bucket, a request spending a token, a drip refilling, the empty bucket refusing, then the pull-back to Redis. The bucket's ten tokens are declared illustrative, and the continuous drip is flagged as an adapted recipe that construction must build. It proposes one refusal mark shared by every later scene. The checker warned that `request-rate-limiter` moves without being cast as an object. The creator directed "Spend this scene on the two rates… Keep the refusal mark simple". r2 answered with a new moment, *Requests outrun the drip* (arrivals at three per tick against a drip of one, illustrative). It also said plainly that no line in the draft script covers that beat, rather than writing narration of its own. r2 was compared with r1 and reviewed (22, 23).

**s03 · Rate limiters vs load shedders (comparison).** Its idea is that the input each tool reads is what the viewer should see. The rate limiter's wire drops into one caller's lane; the load shedder's climbs to a whole-system panel. Both refuse with the same mark, so the only visible difference is the input. It holds back the status codes (429, 503) for the scenes that explain them. r3, made after the revision, says the page notes' chip layout and 18 px gate "were written for a slide and its presenter rail; they are not adopted here".

**s09 · How often each one fires (numbers).** It uses only Stripe's own monthly figures: millions, 12,000, "a very small fraction" and 100 (¶19, ¶25, ¶32, ¶44). An adapted "unmeasured rung" keeps "a very small fraction" as a phrase and never turns it into a number. It chooses an ordinal descent over a log axis, which could not place a count Stripe never gave. Its r2 is the superseded result described above.

**s12 · Start with one limiter (presenter, delivery set to my voice).** r1 kept the voice as human and took on-camera presence (full, shared, full) from the slide notes. r2, after the revision, keeps the human voice and leaves presence undecided in every moment. It suggests two moments where appearing would help and reserves no space for a presenter. That matches the plan's rule that presenter visibility is separate from the voice source.

**Across scenes.** The two mechanism plans converge on a video-wide refusal language. They estimate 31–41 s for scenes against a 30 s average and each says so. They flag script gaps instead of filling them. That is the input H0 needs, as the next section describes.

## Fixes made during acceptance

| Finding | Fix | Commit |
|---|---|---|
| A planning run's directory received all eight studio skills, including the drawing and building ones, all listed in its AGENTS.md. Tools were already restricted | A planning run installs `video-planner` only; the run manager refuses a planning record started with another skill | `179b3c02` |
| Slide layout notes were presented to the planner as the creator's words | Kept in the presentation reference, labelled as slide layout, no longer quotable as creator text; skill 0.1.1 and the brief contract say so | `19a8db8a` |
| The workspace re-renders every 3 s while runs report, which reset scroll positions and wiped direction being typed | Scroll, focus, caret and unsaved direction survive renders; the planning check types across one | `71184521` |
| Stale plans all read "inputs changed (direction, theme or source)" | Brief and plan name what changed | `0ba8ac22` |
| A recipe used in several moments repeated its construction risk | Each risk and warning reported once | `4391108d` |
| A failed run's provider status began with a stray separator | Trimmed; Kimi's stderr tail skips blank lines | `179b3c02` |
| A base's read-only view told the creator to generate | Points to the video notebook | `58886a01` |
| Two forks of one base had identical names in the selector | A shared title is completed with when each was made | `460bf99a` |
| Reviewing a newer candidate left two revisions reading "reviewed" | Earlier ones read **previously reviewed** | `05a78bc7` |
| A reviewed plan's time showed when it was reviewed | Shows when it was requested | `ecef1a06` |

Before the run, the workspace's first captures had shown buttons styled for the dark app chrome, editable direction boxes in the read-only view, and failure text that repeated itself. Those were fixed in `931f53b7`.

## What this does not establish

- **Kimi and Codex never completed a planning run.** Kimi's quota was exhausted and Codex is not installed. The Kimi failure path is real, but Kimi's plan quality is untested. So is its tool registration in a fresh run directory: the adapter registers the planning tools in the run's own Kimi home, because Kimi skips an untrusted folder's project configuration.
- **Nothing was built.** Every catalogued recipe the plans name is "catalogued but not yet proven in the installed runtime" (`@hyperframes/*` 0.7.106), and every plan lists these as construction risks.
- **Persistence.** Acceptance ran on local persistence. The PostgreSQL path is covered by unit tests and an earlier SQL check, not by this run.
- **Build under test.** The branch was accepted together with the main checkout's uncommitted repairs; the branch alone was not driven with a real harness.
- **Two runs predate a fix.** Brief r1 and r2 ran before planning runs were narrowed to the planning skill (each run's `installed-skills.txt` shows it). s10 r1's risk list predates the deduplication.
- **Harness preference.** It is stored per origin. The test app took a new port at each restart, so the preference reset. The product's own origin was not checked here.
- **Clicks.** They were issued through the test hook to the page's real handlers, and the captures are stills of the app window.

## What H0 should take from this

- **A shared refusal mark.** s03 and s10 each propose one refusal mark reused across scenes. Construction needs a reusable, versioned house element before the first scene that uses it.
- **Script gaps.** Plans say where the draft script lacks a line, for example s10's "requests outrun the drip". The script and director flow should accept those as proposals rather than leave them in prose.
- **Illustrative values.** Bucket sizes and drip rates are proposals, and construction must keep them labelled as such on screen and in review.
- **The time split.** It stays open at the brief level. The scene estimates (31–41 s against a 30 s average) need the arc pass to settle it before construction.

## Validation of the branch

At `ecef1a06`:

- `apps/studio-v2`: typecheck, 186 tests and the production build pass.
- `apps/studio-desktop`: typecheck and 7 unit tests pass. The planning check passes all 28 assertions: a stub harness driven through the real workspace, registered in the release check. It covers tool and skill scope, packet contents, grounded and invented briefs, candidate, superseded and failed plans with the reviewed plan kept, typed direction surviving renders, reload, the base's read-only view, and that nothing downstream runs.
