# Review 5 fixes

5 October 2026 · 6af09486 → HEAD · Kimi K3

Every finding in review 5 has a change in this PR, except reordering undrawn scenes mid-run, and so does each of the wireframe analysis’s six recommendations. The headline: Kimi K3 drew all ten wireframes in 13.7 minutes with no Try again, from 2.9 M tokens — review 5 took 54 minutes, five Try again presses and 7.9 M tokens. Each page is a call of its own with a 9 KB packet, three at a time, checked as it is saved; planning thinks hard, drawing thinks lightly, and Activity shows the tokens each step used. Nothing stands between Create and the first wireframe, progress is said once, and the brand step is replaced by a look chosen beside the wireframes.

Before images are review 5's own annotated captures (red marks). After images carry green marks with the same numbers; blue letters are Open Slide borrowings.


## The run

One live run per column, each with Kimi K3 (kimi-code/k3) on stripe.com/blog/rate-limiters in a fresh scratch store. Review 5 ran the code it reviewed; the first fix drew one page per call but still handed each call the whole article, outline, brief, manuals and its own design spec; this PR is the run after the wireframe analysis’s six changes. Times come from each store’s run records, tokens from Kimi’s own session logs.

| Step | Review 5 (6af09486) | First fix: a page per call (412d50bc) | This PR (b4101043) |
|---|---|---|---|
| Reading the article, then the story | 7.1 min | 5.7 min | 5.3 min |
| Wireframes: time to all ten | 53.6 min, with five Try again presses | 60.4 min to show all ten; stopped at 62.4 min with nine accepted (page 8 on its third call) | 13.7 min, all ten accepted, no Try again |
| Agent calls for the wireframes | 7, each for the whole deck | 11, one page each | 10, one page each |
| Minutes per call | 10.0 (five of seven cut off at the 10-minute limit) | 5.7–15.0 (median 10.2) | 0.8–6.6 (median 2.5) |
| Tokens for the wireframes | 7.87 M | 13.69 M | 2.89 M |
| …new input · output | 0.48 M · 0.11 M | 0.82 M · 0.23 M | 0.16 M · 0.06 M |
| Tokens per page call (median) | 1.19 M (a whole-deck call) | 1.29 M | 0.30 M |
| Files read per call (median) | 15 | 14 | 5 |
| Thinking effort · limit on one response | high · 1,048,576 tokens | high · 1,048,576 tokens | low · 32,000 for a page; high · 64,000 for reading and story |
| Token use shown in the notebook | 0 | 0, for 13 calls | Per step: 3.3 M in all |
| One pinned wireframe change | Stopped at its 4-minute limit | Queued during drawing; not measured | 1.3 min, one call, 0.12 M tokens |
| One video scene (off camera, voice Daniel) | Stopped twice at the 4-minute composition limit | Not run | Produced in 21.8 min with no stops, joined at 23.3 min; 4 calls, 2.49 M tokens |

- All tokens are Kimi’s own counts from its session logs (new input, cache reads and output); the first two runs recorded none in the notebook.
- The first fix ran at 412d50bc; this PR’s run used b4101043, and its pinned change and video scene ran after 3406e771, which fixed two packet mismatches the run found (object ids, title-line boxes).

## Wireframe time and tokens

The wireframe analysis of review 5’s run found the drawing stage spending its time and tokens on reading: each call took the whole article, outline and brief, 83 KB of manuals, the checker’s source and a 13 KB design spec it wrote itself, at high effort with no limit on a response, and Kimi’s token use showed as zero. These are the six changes it asked for, each shown on Kimi K3 against the first fix (one page per call, with the old packet). The run table above has the totals.

| Before | After |
|---|---|
| ![The first fix: 130 KB of packet and inputs — the article, outline and brief, the stage context twice, a 14 KB design spec and a motion plan — and page-master’s 388 files.](images/after-packet-v1.jpg) | ![This PR: 9 KB — the spec the studio writes, the page’s scene, one finished page for style — and two skill files.](images/after-packet-v2.jpg) |
| The first fix: 130 KB of packet and inputs — the article, outline and brief, the stage context twice, a 14 KB design spec and a motion plan — and page-master’s 388 files. | This PR: 9 KB — the spec the studio writes, the page’s scene, one finished page for style — and two skill files. |

| Before | After |
|---|---|
| ![One call for page 2 read 18 files (216 KB), ran the checker itself and rendered three previews: 12.2 minutes, 1.42 M tokens.](images/after-reads-v1.jpg) | ![The call for page 2 read 6 files (20 KB), wrote, submitted and corrected what the studio listed: 2.8 minutes, 0.37 M tokens.](images/after-reads-v2.jpg) |
| One call for page 2 read 18 files (216 KB), ran the checker itself and rendered three previews: 12.2 minutes, 1.42 M tokens. | The call for page 2 read 6 files (20 KB), wrote, submitted and corrected what the studio listed: 2.8 minutes, 0.37 M tokens. |

| Before | After |
|---|---|
| ![Two pages at a time, each call 6 to 15 minutes.](images/before-10-drawing-mid-tokens.jpg) | ![Page one alone, then three at a time.](images/after-10-drawing-three-tokens.jpg) |
| Two pages at a time, each call 6 to 15 minutes. | Page one alone, then three at a time. |

| Before | After |
|---|---|
| ![Every request at high effort, allowed a 1,048,576-token response (Kimi’s own request log).](images/after-effort-v1.jpg) | ![High for reading and the story; low for each page, with a 32,000-token limit on one response.](images/after-effort-v2.jpg) |
| Every request at high effort, allowed a 1,048,576-token response (Kimi’s own request log). | High for reading and the story; low for each page, with a 32,000-token limit on one response. |

| Before | After |
|---|---|
| ![Agents checked their own pages: 19 checker runs, 10 reads of its 32 KB source, 27 preview renders.](images/after-checks-v1.jpg) | ![The studio checked 25 submissions and refused 15, each with its problems listed; agents ran no checker and rendered no previews.](images/after-checks-v2.jpg) |
| Agents checked their own pages: 19 checker runs, 10 reads of its 32 KB source, 27 preview renders. | The studio checked 25 submissions and refused 15, each with its problems listed; agents ran no checker and rendered no previews. |

| Before | After |
|---|---|
| ![Activity listed steps only; the notebook reported 0 tokens for 13 Kimi calls.](images/before-13-activity-v1.jpg) | ![Token use per step, read from Kimi’s session logs after each call.](images/after-13-activity-tokens.jpg) |
| Activity listed steps only; the notebook reported 0 tokens for 13 Kimi calls. | Token use per step, read from Kimi’s session logs after each call. |

- **1 · One page per call, three at a time, from a small packet.** Each page is a call of its own with a 9 KB packet: SPEC.md, PAGE.json (the scene, its neighbours’ titles, the objects it names) and STYLE.svg (the first accepted page). Page one went alone, then three at a time. Calls took 0.8 to 6.6 minutes (the first fix: 5.7 to 15), and the ten were accepted 13.7 minutes after drawing began.
- **2 · Thinking effort per stage, and a limit on each response.** limits.ts gives each operation an effort and a limit on one response: high and 64,000 tokens for the brief, story and video plan; medium for a page, which K3 (low, high or max) takes as low, with 32,000. Kimi’s own request log shows exactly that on every call.
- **3 · No motion plan file.** Nothing downstream read the page programs, so the route no longer asks for them and the studio no longer requires them.
- **4 · A short page guide and a spec the studio fills in; icons by name.** workflows/draw-page.md (5 KB) is the only route, and only it and SKILL.md are installed in a run. SPEC.md (3.4 KB) carries the colours, type, layout, icon names and drawable objects. The call for page 2 read 6 files, 20 KB; the first fix’s read 18, 216 KB, including a 51 KB manual and the checker’s source. The agent writes <g data-icon="server"/> and the studio draws the icon in.
- **5 · Each page checked once, when it is saved.** The studio checks a page when it is submitted — its SVG, name, icons, text in its boxes, connector labels on boxes or other labels, lines through boxes — and lists what to fix. 15 of 25 submissions were refused and corrected; the problems listed included nine connector labels on boxes or on other labels. No agent ran the checker or rendered a preview, and the deck is not checked again.
- **6 · Kimi’s token use, per step.** Kimi reports no tokens over ACP, so after each call the adapter sums the usage records in the session’s wire log. Activity shows them per step: new input, cached, output and total.

## Start screen

| Before | After |
|---|---|
| ![Your notebooks sat below a 900 px window, under the demo.](images/before-home.jpg) | ![Your notebooks straight under the field; the demo behind How it works.](images/after-home.jpg) |
| Your notebooks sat below a 900 px window, under the demo. | Your notebooks straight under the field; the demo behind How it works. |

![A first visit, with no notebooks yet, still gets the demo.](images/after-01-home-first-visit.jpg)

_A first visit, with no notebooks yet, still gets the demo._

- **1 · Your work is in sight.** The notebook tiles sit straight under the field, titled “Your notebooks”, eight at a time.
- **2 · The demo shows on the first visit only.** Until there is a notebook; after that it opens from a small How it works link, in a dialog.
- **3 · One field, and Enter starts.** Unchanged.
- **4 · The tagline, dots and pause button went with the demo.** They belong to the demo and appear only with it.

## Notebook

| Before | After |
|---|---|
| ![Two Create buttons, the agent twice, Review brand, the title twice, the byline as a figure.](images/before-notebook.jpg) | ![One Create button in the header, one line with the choices it will use, the title once.](images/after-notebook.jpg) |
| Two Create buttons, the agent twice, Review brand, the title twice, the byline as a figure. | One Create button in the header, one line with the choices it will use, the title once. |

| Before | After |
|---|---|
| ![Diagrams arrived as “(figure: …)” lines of text.](images/before-figures.jpg) | ![The article’s picture above its caption.](images/after-notebook-figure.jpg) |
| Diagrams arrived as “(figure: …)” lines of text. | The article’s picture above its caption. |

- **1 · One Create button.** The header button, in the same place on every stage. The card became one line: “Next: Create wireframes, top right.”
- **2 · The agent once.** The header pill. The source row’s Model button is gone.
- **3 · No Review brand in the source row.** There is no brand dialog any more (see Look below).
- **4 · The title once.** When the article starts with its own title, the notebook heading steps aside.
- **5 · The byline is not a figure.** The reader keeps an author avatar and its caption out of the text, as the source’s byline. The date follows the title.
- **6 · Stage captions in plain words.** “next” in the UI font, not “not started” in a code font; a greyed Video says why on hover: “Make the wireframes first”.
- **7 · The article’s pictures are kept.** Each figure becomes its picture, as Markdown, above its caption in italics. The agent reads the same Markdown.
- **H · Questions in the flow.** One row of filled-in choices beside Create: the agent and model, about 6/10/14 wireframes, and the look. Each opens a small menu.

## Agent and model

| Before | After |
|---|---|
| ![Choose agent opened this full Settings page: two marks per card, names twice, “Supported” everywhere.](images/before-agent.jpg) | ![The same page in plain words — and the header pill now opens a small menu instead (below).](images/after-settings-agent.jpg) |
| Choose agent opened this full Settings page: two marks per card, names twice, “Supported” everywhere. | The same page in plain words — and the header pill now opens a small menu instead (below). |

![The header pill opens a small menu: the agents found here, one mark each, the model in a menu.](images/after-agent-menu.jpg)

_The header pill opens a small menu: the agents found here, one mark each, the model in a menu._

- **1 · A small menu under the header button.** The agents found on this computer, the model in a menu, Done. Settings keeps the full page.
- **2 · One mark per card.** The radio button only; “On this computer” instead of a second tick.
- **3 · Each model name once.** A second line only when it adds something (an unavailable reason, or the id behind a label).
- **4 · No “Supported” badge on every row.** A badge only for an unavailable model.
- **5 · Our words, not theirs.** “From your Kimi settings.” and “Found Claude Code and Kimi on this computer.” The miscounted “4 listed” is gone.
- **C · One agent pill.** “Kimi · drawing 3 of 10” while it works; the model lives in its menu.

## Brand → Look

| Before | After |
|---|---|
| ![A tall dialog before the run, presenting the built-in orange as “Suggestion from stripe.com”.](images/before-brand.jpg) | ![The look, in a panel: named looks with a sample, three colours, two font menus.](images/after-look-notebook.jpg) |
| A tall dialog before the run, presenting the built-in orange as “Suggestion from stripe.com”. | The look, in a panel: named looks with a sample, three colours, two font menus. |

| Before | After |
|---|---|
| ![Eight raw fields with Windows fonts; one label, two outcomes.](images/before-brand-bottom.jpg) | ![Beside the wireframes, a look re-colours them as you choose; nothing saves until Apply.](images/after-look-ink.jpg) |
| Eight raw fields with Windows fonts; one label, two outcomes. | Beside the wireframes, a look re-colours them as you choose; nothing saves until Apply. |

| Before | After |
|---|---|
| ![Then a third dialog explained wireframes as the run started.](images/before-explainer.jpg) | ![Create goes straight to the wireframes: no agent page, brand dialog or explainer.](images/after-07-outline-before-pictures.jpg) |
| Then a third dialog explained wireframes as the run started. | Create goes straight to the wireframes: no agent page, brand dialog or explainer. |

- **1 · The fallback is never offered as the site’s brand.** A notebook starts with a look saved for the site, else the site’s colours when they were read, else the neutral Paper look. stripe.com showed none, so it starts with Paper.
- **2 · Small samples, not four large previews.** Five named looks (Paper, Ink, Blueprint, Mint, Ember), each a small title page and one sentence.
- **3 · No placeholder copy.** Each sample shows the notebook’s own title.
- **4 · One name: Look.** Look beside the wireframes; Settings → You for your name and logo.
- **5 · Three colours and two font menus.** Background, Text, Accent; Headings and Text fonts from a menu (Inter, Georgia, system faces) — no typed Windows font names.
- **6 · One label, one outcome.** There is no dialog to reopen. The panel says “Use this look” before drawing, “Apply to all wireframes” after.
- **7 · No dialogs before the first wireframe.** The explainer is gone; the canvas opens on the story’s first scene.
- **F · Named looks, then a live side panel.** Drawn wireframes re-colour live (each tint re-mixed from the new look); later pages and changes are drawn from a spec the studio writes from the new look. “Save for stripe.com” keeps it for the next notebook from that site.

## Settings

| Before | After |
|---|---|
| ![The brand dialog had saved stripe.com as Your name; raw hex and font names; the browser’s file control.](images/before-settings-branding.jpg) | ![Settings → You: your identity only; saved looks as swatches; a styled logo button.](images/after-settings-you.jpg) |
| The brand dialog had saved stripe.com as Your name; raw hex and font names; the browser’s file control. | Settings → You: your identity only; saved looks as swatches; a styled logo button. |

| Before | After |
|---|---|
| ![A second set of AI choices that do nothing while an agent is set.](images/before-settings-keys.jpg) | ![Folded away while an agent is set, saying when they are used.](images/after-settings-keys.jpg) |
| A second set of AI choices that do nothing while an agent is set. | Folded away while an agent is set, saying when they are used. |

- **1 · Your name stays yours.** A look never writes the creator’s name: Settings’ name, description and logo apply on their own, and new notebooks take only those from Settings.
- **2 · Swatches and a sample, not raw values.** Saved looks show three colour swatches and their name in their own heading font.
- **3 · A styled file control.** “Choose a logo…” with the file name beside it.
- **4 · Voices on this Mac.** Unchanged.
- **5 · The second set of AI choices folds away.** “Your agent writes and draws your videos. The provider and models below are used only when no agent is chosen.”

## While Kimi works

| Before | After |
|---|---|
| ![Progress four times over, status three more times, the outline hidden, no notebook name.](images/before-designing.jpg) | ![Kimi K3 drawing, live: the count once (in the pill), every planned scene as a titled tile, the notebook’s name.](images/after-10-drawing-three.jpg) |
| Progress four times over, status three more times, the outline hidden, no notebook name. | Kimi K3 drawing, live: the count once (in the pill), every planned scene as a titled tile, the notebook’s name. |

| Before | After |
|---|---|
| ![A raw event log: no times, duplicates, “presentation” and “slides”.](images/before-history.jpg) | ![Activity: steps with their times, once each, in wireframe words.](images/after-activity.jpg) |
| A raw event log: no times, duplicates, “presentation” and “slides”. | Activity: steps with their times, once each, in wireframe words. |

![Live: a scene not drawn yet shows its title and script.](images/after-08-outline-scene-4.jpg)

_Live: a scene not drawn yet shows its title and script._

- **1 · Progress, once.** The agent pill counts (“Kimi · drawing 3 of 10”); the tab says one word (“drawing”). The run strip and the “0 drafts saved” line are gone.
- **2 · No status repeats.** “Building your wireframes”, “Designing your wireframes” and “Generation in progress” are gone from the canvas.
- **3 · The outline straight away.** As soon as the story is planned, every scene is a titled tile (Drawing… / Waiting); selecting one shows its title and script.
- **4 · One door to Activity.** The run strip’s Activity button went with the strip; one Activity button remains.
- **5 · The notebook’s name in the header.** After the logo, as in Open Slide.
- **6 · A chat box that is ready when it says so.** A drawn wireframe takes changes while the rest are drawn (they queue until the deck is done); an undrawn one says “Changes open once this wireframe is drawn” in a dashed, disabled style.
- **7 · Steps with times.** A retry no longer re-announces every page; old decks’ duplicates are folded away.

## When the run stops

| Before | After |
|---|---|
| ![System words in the good-news colour; “needs you” and “needs attention” without saying what; nine invisible wireframes.](images/before-failed.jpg) | ![One notice in the warning colour, in plain words; the missing wireframes still visible as tiles.](images/after-stopped.jpg) |
| System words in the good-news colour; “needs you” and “needs attention” without saying what; nine invisible wireframes. | One notice in the warning colour, in plain words; the missing wireframes still visible as tiles. |

- **1 · Plain words, warning colour.** “Kimi ran out of time on wireframe 2 of 10, after three tries. 1 is drawn; Try again continues from wireframe 2.” Older saved stops read in the new words too.
- **2 · Say what is wrong, once.** The tab says “stopped”; the notice says what and what Try again does.
- **3 · The missing wireframes are visible.** Not drawn yet, as titled tiles.
- **4 · No skill labels on the slide.** No “§ NN · …” eyebrow and no “SHEET NN / 10” footer: the skill no longer draws them and the checker refuses them (see the live wireframes).
- **5 · No fallback orange.** The live run used the Paper look.
- **— · And the run is less likely to stop.** One page per agent call, each with its own time sized for the model, retried up to three times before it stops. See The run.

## The wireframes

| Before | After |
|---|---|
| ![Kimi K3’s ten wireframes in review 5: label collisions, page furniture, the fallback orange.](images/before-sheet.jpg) | ![Kimi K3’s ten wireframes in this run, unedited.](images/after-12-sheet.jpg) |
| Kimi K3’s ten wireframes in review 5: label collisions, page furniture, the fallback orange. | Kimi K3’s ten wireframes in this run, unedited. |

| Before | After |
|---|---|
| ![All ten ready: no script, one box for every change, “Wireframes ready” twice.](images/before-ready.jpg) | ![All ten ready: the script under the wireframe; point at a part; one ready line.](images/after-11-ready.jpg) |
| All ten ready: no script, one box for every change, “Wireframes ready” twice. | All ten ready: the script under the wireframe; point at a part; one ready line. |

| Before | After |
|---|---|
| ![Delete cut off by the scrolling area.](images/before-menu.jpg) | ![The menu is a popover; Delete is whole.](images/after-menu.jpg) |
| Delete cut off by the scrolling area. | The menu is a popover; Delete is whole. |

| Before | After |
|---|---|
| ![A change for the whole wireframe, shown only in a corner of the tab that asked.](images/before-revise.jpg) | ![Live: a change pointed at one part of wireframe 1, shown where it happens — the pill says “changing wireframe 1”, the tile says “changing”.](images/after-15-change-running.jpg) |
| A change for the whole wireframe, shown only in a corner of the tab that asked. | Live: a change pointed at one part of wireframe 1, shown where it happens — the pill says “changing wireframe 1”, the tile says “changing”. |

![Live: clicking the title pins the change to it — a selection box, and “On: Scaling your API” in the change box.](images/after-14-pin.jpg)

_Live: clicking the title pins the change to it — a selection box, and “On: Scaling your API” in the change box._

![Live: the change took 1.3 minutes in one call. The boxes behind both title lines are gone; the subtitle keeps its box, because “the line under it” was read as the title’s second line.](images/after-16-changed.jpg)

_Live: the change took 1.3 minutes in one call. The boxes behind both title lines are gone; the subtitle keeps its box, because “the line under it” was read as the title’s second line._

![Rehearse (Open Slide’s presenter view): the wireframe, the next one, its script and a timer.](images/after-rehearse.jpg)

_Rehearse (Open Slide’s presenter view): the wireframe, the next one, its script and a timer._

- **1 · A clear story, one idea per page.** Unchanged.
- **2 · Label collisions are checked.** check_pages.py now refuses a connector label on a box or another label, text spilling past its box, and a line through a box. On the review’s ten pages it flags exactly the clashes the review circled on wireframe 4.
- **3 · No skill furniture.** The skill and the fallback renderer drop the eyebrow and sheet number; the checker refuses them.
- **4 · No fallback orange.** Paper look by default when a site shows no colours.
- **6 · The script under each wireframe.** Editable once the deck is ready; it saves as you type and updates the video plan.
- **7 · Point at what should change.** Click a box, arrow or label: the change carries that element, and a pinned change skips the story step and edits the current page.
- **8 · “Wireframes ready”, once.** One line under the change box, until a change is asked.
- **9 · Delete is not cut off.** The wireframe menu is a popover outside the scrolling area.
- **10 · Work shows where it happens, in every tab.** A change is on the notebook (queued / changing / failed), so it shows on the wireframe and its tile after a reload, and the pill says “changing wireframe 4”.
- **11 · Changes get time, and say the real cause.** Budgets per model (a K3 redraw gets 20 minutes, not 4); failures say “Kimi ran out of time while changing this wireframe”, in the warning colour, without the misleading toast.
- **G · A rehearsal view.** Rehearse: ← → move, P presenter or full slide, F full screen, Esc leaves.

## One video scene

| Before | After |
|---|---|
| ![A “Clone your voice · 30s” side door.](images/before-video-dialog.jpg) | ![Two questions, no side door.](images/after-video-dialog.jpg) |
| A “Clone your voice · 30s” side door. | Two questions, no side door. |

| Before | After |
|---|---|
| ![“1 scenes”, status three times, the wrong example, controls over the slide, two ways to finish.](images/before-video-planning.jpg) | ![One scene, live, while it is planned: “1 scene”, one status, nothing over the slide, the off-camera example, one way to finish.](images/after-v2-video-working.jpg) |
| “1 scenes”, status three times, the wrong example, controls over the slide, two ways to finish. | One scene, live, while it is planned: “1 scene”, one status, nothing over the slide, the off-camera example, one way to finish. |

| Before | After |
|---|---|
| ![Two titles on top of each other; moments you can’t tell apart; Prepare twice.](images/before-scene-written.jpg) | ![No title card over the page’s own title; numbered, titled moments; one name for finishing.](images/after-v3-video-written.jpg) |
| Two titles on top of each other; moments you can’t tell apart; Prepare twice. | No title card over the page’s own title; numbered, titled moments; one name for finishing. |

| Before | After |
|---|---|
| ![The same stop in the same words; activity collapsed; buttons that look ready.](images/before-video-failed.jpg) | ![The stop names the agent, in the warning colour; activity open; disabled buttons look disabled.](images/after-video-scene.jpg) |
| The same stop in the same words; activity collapsed; buttons that look ready. | The stop names the agent, in the warning colour; activity open; disabled buttons look disabled. |

![Live: the one scene, produced and joined 23 minutes after the dialog, with no stops (review 5’s stopped twice at the 4-minute composition limit). The play controls sit under the scene; the header’s last name is Export MP4.](images/after-v7-video-done.jpg)

_Live: the one scene, produced and joined 23 minutes after the dialog, with no stops (review 5’s stopped twice at the 4-minute composition limit). The play controls sit under the scene; the header’s last name is Export MP4._

![Two frames from that scene, as Kimi K3 composed it: 0:24 and 0:44 of 0:54.](images/after-v5-frames.jpg)

_Two frames from that scene, as Kimi K3 composed it: 0:24 and 0:44 of 0:54._

- **1 · Two questions, plainly put.** Unchanged.
- **2 · No side door.** Voice cloning stays in Settings → Voice.
- **3 · “1 scene”.** The count handles one.
- **4 · Status once.** Scene activity is the one place a scene’s progress shows, with a live marker on the current step; the pill above the player is gone.
- **5 · The right example.** “say this part more slowly” for an off-camera moment; “move me left” on camera. The live run showed the camera example while an off-camera scene was still planned; it now follows the video’s camera setting until the scene has moments.
- **6 · The player does not cover the slide.** Play controls sit under the scene; clicking the scene plays or pauses. The live run found the bar the review circled still drawn while the brief was prepared — the camera-take controls rendered for a scene with no moments — and they now need a recorded take.
- **7 · One way to finish.** The header finishes the video; a scene’s own button shows only for its own step (record, try again) or for one of several scenes.
- **8 · The stop in plain words.** “Kimi ran out of time…”, in the warning colour; older saved sentences read in the new words.
- **9 · Where it stopped stays visible.** Scene activity stays open when a scene stops.
- **10 · Disabled buttons look disabled.** Faded, dashed, not-allowed cursor.
- **11 · One title.** Off camera, no title card is drawn over a page that carries its own title, in the preview and in the render.
- **12 · Moments you can tell apart.** Each tile shows its number, its title and “Voice” / “Record” / “Recorded”, never “auto”.
- **13 · Prepare once.** The header keeps one name; the per-scene Prepare is gone for a single scene.
- **16 · The same button keeps its name.** “Finish the video · 0/1” until Export MP4. While it works, the disabled button says what it is doing (“Preparing scenes…”), then returns to that name.

## Code and CI

| Finding | Review 5 | This PR |
|---|---|---|
| CI formatting | Failed on six files | Formatted; format:check and the size check pass. |
| App script on the start screen | 861 KB (281 KB gzipped) | 377 KB (128 KB gzipped) with every new component in this PR; TipTap and ProseMirror load when a notebook’s notes open, as their own 504 KB chunk. |
| Fixed stage limits | Every stage capped at 10 minutes, at high effort, with no limit on a response | engine/harness/limits.ts: budgets per operation and model (K3 at 2.5×), 45-minute ceiling; thinking effort per operation and a limit on one response. |
| Fallback brand shown as a suggestion | Provenance ignored | engine/looks.ts reads provenance: fallback → Paper. |
| Pictures dropped | “(figure: …)” text | engine/source-document.ts keeps the picture above its caption. |
| Title rendered, then hidden | display: none | Shown after the logo. |
| Light theme keeps a dark header | Near-black bar | Header tokens per theme. |
| Tests | 498 | All pass, with new tests for per-page drawing, limits, the change queue, looks, figures, the checker and the screens. |
| Vercel check | Fails (nothing deploys there) | Unchanged: it needs the Vercel integration turned off in the repository settings. |

## Not done

- Dropping or reordering scenes while their pages are still being drawn (the review’s “can drop or reorder scenes”). Undrawn scenes show as tiles and can be read; editing the outline mid-run is not wired.
- Open Slide’s rail picture for each video moment: moments show their number and title, not a picture.
- Wireframe 10 of the live run still has tinted boxes behind its title lines: it was drawn before the guide fix (3406e771). Wireframe 1 was changed live; a fresh drawing on the fixed guide was not run again, to keep the run to one deck.
- A few rough edges remain on the low-effort pages: page 5’s large figure touches its label, and an icon’s small mark touches its caption on page 4. The checker measures text against boxes and labels, not icons against text.
- The Vercel check still fails; nothing deploys there, so the integration should be turned off in the repository’s settings.

## Method

- Before images are review 5’s own annotated captures of PR head 6af09486 (red marks, its numbering), or, for the wireframe time and tokens section, captures and data from the first fix’s live run (coral marks).
- After images were captured at 1440 × 900 in Electron from this branch. Green marks carry the review’s numbers (or the analysis’s six, in that section); blue letters are Open Slide borrowings.
- The cards in the time and tokens section are drawn from real run folders and Kimi’s own session logs: file names, sizes, request settings and token counts, never file contents.
- The live states come from one run with Kimi K3 (kimi-code/k3) on stripe.com/blog/rate-limiters, in a scratch store on its own ports, from a frozen copy of the code. As agreed, all ten wireframes were generated, one pinned change made, and only one video scene, on a copy of the notebook holding just the first wireframe.
- Kimi’s outline and wireframes are shown as Kimi made them.
