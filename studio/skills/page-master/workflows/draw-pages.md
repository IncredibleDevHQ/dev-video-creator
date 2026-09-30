# Draw Pages — runtime authority

ppt-master's Default pipeline, with its ends replaced: research and template selection are already done (the studio read the source and confirmed the outline), and the output is contract SVG rather than PPTX. Everything between is theirs, and their manuals are the authority for it.

`Inputs → Communication contract → Design Spec → Spec Lock → Executor (page by page) → Checker cadence → Visual review → Receipt`

## Inputs

`motion/inputs.json` in the project directory:

- `video`: `{ title, site }`
- `brand`: `{ palette: { ground, text, accent, secondary }, fonts: { display, body, mono }, mode }`
- `scenes[]`: `{ index, title, kind, seconds, idea, narration, source[], parts[{ kind, label, detail }], relations[{ from, to, verb }] }`
- `objects[]` (when present): the explanation model's things — `{ id, label, kind, scenes[] }`, where `id` is the stable model id (`obj-…-<n>`) that stays the same on every page that names the thing. A node whose label matches an object declares `data-object-id` with it (see the contract). `modelId` identifies the model revision these pages are drawn from.

`source` is the article's own sentences for this scene, copied verbatim. They
are the ground truth for the page and its program: the example the author
chose, the number they gave, the reason one thing causes another. Read them
before deciding what the page shows and what happens on it — the narration is
a draft, the passages are what the article actually said.

Scene kinds: `title`, `list`, `diagram`, `numbers`, `quote`, `close`. The narration is the line the page must support — read it; it says what the page is for.

## Forms, not boxes

The scene's kind sorts the deck; the page's **form** is how it explains.
Choose the form from what the viewer must understand, then draw that — a
rectangle is acceptable when it is a genuine container or an honest
placeholder, never the universal answer.

| What the scene explains | The form to draw |
| --- | --- |
| A mechanism (cause → effect) | The parts and the travelling actor between them; the change is visible |
| Capacity or a budget | A pool of slots that fill and free, not two boxes and an arrow |
| Waiting or scheduling | A timeline or queue with positions, not a static row |
| A rate or quantity over time | A chart or meter with a baseline, not a number alone |
| A comparison | Aligned panels, same frame, same axes — difference is the point |
| A sequence | Ordered stages left to right, one direction of travel |
| A definition or summary | Typography-led node(s); no invented mechanism |
| Code or data | The real code block or table, with the one line that matters marked |

Record the choice as the page's `topology` in the receipt, and say `form`
alongside it (`mechanism`, `pool`, `timeline`, `chart`, `comparison`,
`sequence`, `definition`, `code`). A deck where every page is a grid of
identical boxes has failed this stage, whatever the checker says.

## Stage 1 — Communication contract

Write `pages/contract.md`, six lines, from the inputs alone: audience, objective, core message, consumption mode (a narrated video, watched not read), the one thing a viewer must remember, and what this deck deliberately does not cover. No user gate: the studio already confirmed the outline with the author.

## Stage 2 — Design Spec

Read `${SKILL_DIR}/vendor/ppt-master/templates/design_spec_reference.md` §§I–VI and IX, then author `pages/design_spec.md` to it — the same sections, at the depth the reference describes:

- **I Project information**, **II Canvas** (1280×720, `viewBox 0 0 1280 720`).
- **III Visual theme**: theme style in one sentence and the one visual idea that carries the deck; the colour scheme as exact hex derived from `brand.palette` — ground, surface, line, text, muted, accent, warning — each with the role it plays. One accent, one meaning.
- **IV Typography system**: the font plan from `brand.fonts` and an exact font-size hierarchy — eyebrow, page title, node label, node detail, figure, footer — in px.
- **V Layout principles**: deck-wide direction, the safe area (x 80–1200, y 120–660), the rhythm a page keeps, how the hero of a page is made to read first.
- **VI Icon usage**: the library is the project-local pool at `${SKILL_DIR}/templates/icons` (`index.json` lists every available name, `tabler-outline`, viewBox 0 0 24 24, stroke 2). Name the icons this deck will use, one per kind of thing.
- **IX Page roster**: one row per scene — index, kind, the communication move, the topology or layout it will use, the things on it and their `data-entity`, the icon each will inline.

## Stage 3 — Spec Lock

Copy `${SKILL_DIR}/vendor/ppt-master/templates/scaffolds/spec_lock.md` to `pages/spec_lock.md` and fill every field from the spec: canvas, communication, mode, visual_style, colors, typography, icons (library and stroke width), page_rhythm per page. From here the lock is the authority; a page that departs from it is a bug in the page.

## Stage 4 — Executor, page by page

Read once, before the first page, and reuse for every page:

- `${SKILL_DIR}/vendor/ppt-master/references/executor-base.md` — Page Expression Core, §2.2 per-page decision chain, §3 execution guidelines, §3.0 native shape selection, §4 icon usage, §5 font usage.
- `${SKILL_DIR}/vendor/ppt-master/references/native-shape-authoring.md` §§1–2.1 — contour before encoding: simplest exact native form → independent compound → required Boolean → necessary freeform.
- `${SKILL_DIR}/vendor/ppt-master/references/executor-structure.md` §1–§3 — relationship atoms → topology → construction order, for every `diagram` page.
- `${SKILL_DIR}/references/page-contract.md` — what the studio reads from the page. It is not negotiable.

Then, per page, follow executor-base's decision chain and write `pages/NN_<slug>.svg` (`NN` two-digit, slug ≤ 5 lowercase words).

**Icons are inlined, not referenced.** The contract forbids external references, so an icon becomes part of the page: read `${SKILL_DIR}/templates/icons/tabler-outline/<name>.svg`, take its path elements, and place them inside the thing's artwork group scaled into a 44 px box (`transform="translate(x,y) scale(44/24)"`), `fill="none" stroke="<line or accent>" stroke-width="2"`. Then add the one or two parts that make it live — a status light, a level, a token — and mark them `data-anim` (see the contract). Two or three moving parts per thing.

## Stage 4b — The scene program, page by page

A page is a stage; the program is what happens on it. Straight after writing
`pages/NN_<slug>.svg`, write `pages/NN_<slug>.program.json` — the same page's
story, in beats. The studio compiles it into motion and timing; it does not
invent one for you.

```json
{
  "version": 1,
  "page": "07_central_bucket.svg",
  "cast": [
    { "id": "s07-node-redis-bucket", "role": "bucket", "quantity": { "of": "tokens", "value": 3, "max": 3, "shownOn": "s07-bucket-level" } },
    { "id": "s07-actor-request", "role": "request" }
  ],
  "beats": [
    { "id": "b1", "moment": "establish", "say": "…", "camera": "page", "speaker": "beside",
      "events": [{ "actor": "s07-node-redis-bucket", "action": "appear" }] },
    { "id": "b2", "moment": "explain", "say": "A request arrives and takes one token.", "speaker": "page",
      "events": [
        { "actor": "s07-actor-request", "action": "travel", "to": "s07-node-redis-bucket", "cue": "arrives" },
        { "actor": "s07-node-redis-bucket", "action": "spend", "amount": 1, "cue": "takes" }
      ] }
  ]
}
```

Write the beats from the scene's `source` passages: the example they name is
the example the actors play out, and the causes they give are what `tension`
and `consequence` are about. A program that could have been written from the
title alone has not used them.

**Moments** — one per beat, and they are the shape of the scene, not decoration:
`establish` (put the reader in the place), `explain` (the normal case working),
`tension` (the pressure arriving), `consequence` (what it costs — this beat is
held longest), `resolve` (what fixes it), `aside` (a step to the side). A scene
that is all `explain` has no story; most scenes run establish → explain →
tension → consequence → resolve.

**Actions** — `appear`, `travel` (actor → `to`), `spend` (`amount` off a
quantity), `refill`, `pass` (through, to `to`), `reject` (turned away at `to`),
`become` (an actor takes another's place), `highlight`, `leave`, `state`
(`state: "backed up"` — one of the entity's own states).

**The things the studio can really draw** — before drawing a diagram page, read
`references/objects.json`. If one of its objects is on this page (a bucket of
tokens, a server, a request, a pool of slots, a line of waiting work), the node
for it declares `data-object` and leaves it the room the contract asks for, and
the program binds the story to that object's own pieces. This is how a page
gets real artwork instead of a wireframe box.

**Recomposition** — a beat may also carry `restage`, which changes the
arrangement itself, deliberately, while every thing keeps its identity:

```json
{ "id": "b4", "moment": "consequence", "say": "…",
  "restage": [
    { "id": "s01-node-token-bucket", "grow": 1.5 },
    { "id": "s01-node-served", "to": "left" },
    { "id": "s01-node-rejected", "to": "right" },
    { "id": "s01-label-intro", "clear": true }
  ] }
```

`grow` is a factor of the size the page drew (0.2–3). `to` sends a thing to
`left`, `right`, `centre`, `up` or `down` — the page's own thirds — so two
outcomes can be separated. `clear` takes something off the page once it has
done its job. A restaged thing stays where it was put, keeps its id, and can
still be named by every later beat; an actor travelling to it goes to where it
now stands. Use this at the turn of a scene — a consequence, a resolve — not
on every beat.

**Each shot is about one action.** A beat is a shot, and what the reader sees
in it should be the thing happening — not the whole page competing with it:

- Show what the words claim. "A burst arrives" means several arrivals: send one
  actor per unit spent, one after another, not a single marker with a caption
  saying three. The checker refuses a beat that spends more than it shows.
- Frame cause and outcome together. A `consequence` close-up that holds the
  thing that failed but crops the outcome hides the point; name both in the
  beat's `camera` (the checker asks for it), or restage the outcome next to it.
- Clear what has done its job. An intro line, a caption, a legend: `restage`
  them away with `clear` before the beat that needs the room. What stays should
  be what the beat is about.
- Make an amount unmistakable. The `shownOn` level is the largest thing in its
  node, and every change to it gets a moment to land — 3 → 2 → 0 → 1 should be
  readable without the caption.

Rules the studio enforces:

- Only a `data-actor` may `travel`, `pass`, `reject` or `become`. Nodes never
  move; naming one in those actions degrades to plain emphasis, which is a
  weaker scene. If the story needs something to move, the page must draw it.
- `cue` is a word from that beat's `say`: the event lands when the narrator
  says it. Without a cue, events spread evenly across the line.
- `camera` is `"page"` or a list of ids to move in on. Use it about twice per
  scene; a scene that is all close-ups loses the reader.
- `speaker` is `me`, `beside` or `page` — how the frame is shared for that
  beat. `me` puts the presenter front and centre (openings, a direct address),
  `beside` shares the frame, `page` gives the page the whole frame while it
  works. Open and close `beside`, hand the frame to the page in between.
- `quantity.shownOn` names the element whose height or width is the level, so
  spending and refilling are seen, not asserted. On a node that declared
  `data-object`, name the drawn object's own piece instead —
  `"shownOn": "s07-node-redis-bucket.level"` — and the level is the real
  object's, whatever the drawing turned out to look like.
- `shows` on a cast entry binds an outcome to a piece of the drawn object:
  `{ "id": "s07-node-api", "role": "server", "shows": { "pass": "s07-node-api.indicator" } }`
  lights the indicator when a call goes through. The pieces each object has are
  in `references/objects.json`; naming one it does not have fails the check.
- Every id must exist on the page you just drew.
- A line merged with another keeps both moments: the second lives in the
  first's `then`, with its own events, staging and shot, playing after it
  inside the same line. Write `then` only if you mean two moments in one line.
- `cast` is where a thing's *state* lives — a quantity it holds, a role, a
  starting state. An event may name anything on the page; only things whose
  amount or state changes need a cast entry.

## Stage 5 — Checker cadence

ppt-master checks early and finally; so do you.

1. After the **first** page and its program: `python3 ${SKILL_DIR}/scripts/check_pages.py pages` — fix what it names before drawing page two, so a mistake is made once.
2. After the **last** page: run it again over all pages and fix until it passes.

## Stage 6 — Visual review

The checker sees geometry, not judgement. Read your own pages back and ask of each: does it obey the lock; does the eye land where the narration starts; would a reader recognise the things before reading a word; is any page a grid of identical boxes. Redraw what fails, then re-run the checker.

## Stage 7 — Receipt

Write `pages/receipt.json`: `{ "pages": [{ "file", "program", "index", "title", "kind", "form", "topology", "entities": [{ "id", "entity", "objectId", "icon", "moving parts" }], "moments": ["establish", "…"], "checks": "pass" }], "spec": "pages/design_spec.md", "lock": "pages/spec_lock.md", "model": "<modelId or ''>", "notes": "" }`. Then stop: do not open the notebook, do not plan motion, do not ask questions.

## The look, in one place

The spec you wrote in Stage 2 governs. What follows is the floor, not the ceiling:

- Canvas 1280×720, the ground filled, a faint construction (grid, rules, a horizon) as `data-role="decoration"` at 1–3 % opacity.
- Header: eyebrow `§ NN · VIDEO TITLE` in mono, small, accent; the page title in the display face, 34–44 px.
- Footer: site and `SHEET NN / TOTAL` in small mono, bottom right.
- Nodes: choose their native shape from their meaning. `data-kind="box"` is a parser category, not an instruction to draw a rectangle. A container is justified only when containment is part of the explanation. Use a direct object silhouette, open typography, a quantitative diagram or a labelled mechanism when it communicates better. Labels 22–26 px; details at least 20 px. The base may remain schematic; the video derivative is separately recomposed by explainer-master.
- Connectors: 1.5–2 px in the accent at ~60 %, an arrowhead marker, the verb near the middle when it helps.
- Emphasis with the accent, one thing at a time. Depth from fill and weight, not from shadow.
- No page is a grid of identical boxes; the topology is the page's argument.
