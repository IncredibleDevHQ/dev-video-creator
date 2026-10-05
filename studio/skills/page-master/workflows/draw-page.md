# Draw Page — runtime authority

Draw one page of a narrated video's deck: one 1280×720 SVG, from one scene, in the deck's spec. Read only the packet; it holds everything the page needs.

## Read

- `packet/SPEC.md` — the deck's colours, fonts, sizes, layout, icon names and drawable objects. It governs; a page that departs from it is a bug in the page.
- `packet/PAGE.json` — this page: `index`, `title`, `kind`, `idea`, `narration`, `source` (the article's own sentences for it — the ground truth), `parts`, `relations`, and `deck` (the video's title, the pages before and after this one, the objects named across the deck).
- `packet/STYLE.svg`, when present — a finished page of this deck. Match its grammar (title placement, node style, spacing); do not copy its content.
- `packet/FIX.json`, when present — problems the studio found in this page last time, with the refused draft as `packet/CURRENT_PAGE.svg`. Correct it rather than starting over.
- `packet/EDIT.json` with `packet/CURRENT_PAGE.svg`, when present — the creator's change. `target`, when set, is the element they pointed at: change that part first and keep everything they did not ask to change.

Do not read anything else: no manuals, no icon files, no scripts.

## Choose the form

The scene's kind sorts the deck; the page's form is how it explains. Choose it from what the viewer must understand:

| What the scene explains | Form |
|---|---|
| A mechanism (cause → effect) | the parts and a travelling actor between them |
| Capacity or a budget | a pool of slots that fill and free |
| Waiting or scheduling | a queue or timeline with positions |
| A rate or quantity over time | a chart or meter with a baseline |
| A comparison | aligned panels on the same axes |
| A sequence | ordered stages, one direction |
| A definition or summary | typography-led node(s), no invented mechanism |
| Code or data | the real code block or table, the line that matters marked |

A page that is a grid of identical boxes has failed, whatever the checks say.

## Write `pages/NN_<slug>.svg` (NN two digits, slug ≤ 5 lowercase words)

- Root: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" width="1280" height="720" font-family="…" font-size="22" data-page-role="<kind>" data-page-index="<NN>">`.
- Chrome: `<g data-role="background">` (the ground), `<g data-role="header">` with `<text id="sNN-title">` on list, diagram and numbers pages. On title, quote and close pages, put each line in its own `<g id="sNN-node-…" data-role="node" data-kind="label">` instead. No page furniture.
- Ids: every element the narration may name has a unique lowercase id prefixed `sNN-` (`s03-node-rate-limiter`, `s03-edge-2`).
- Nodes: `<g id="sNN-node-<slug>" data-role="node" data-kind="box|label|number|quote|row">` with one shape that has a fill, and its label as `<text>`. A diagram needs at least two nodes; a list page's rows are nodes with `data-kind="row"`.
- Things: a node that is a `server`, `database`, `cache`, `queue`, `client` or `service` says so with `data-entity` and carries `<g id="sNN-node-<slug>-art" data-appearance-for="sNN-node-<slug>">`: an icon by name plus one or two parts of your own, two to eight shapes in all, two or three marked `data-anim="blink|pulse|flow|fill|spin|wave"`. Its words then start at least 64 px right of the node's left edge. A node whose label matches one of `deck.objects` declares `data-object-id` with that id. A node that is one of SPEC.md's drawable objects declares `data-object` and leaves it at least 110 px a side.
- Connectors: `<line|path id="sNN-edge-<i>" data-role="connector" data-verb="<verb>" data-from="<node id>" data-to="<node id>" marker-end="url(#sNN-arrow)">`, one `<marker id="sNN-arrow">` in `<defs>`. Verbs: sends to, waits for, calls, reads, writes, returns, splits into, merges into, depends on, becomes, contains, compares with, feeds, triggers. A verb label is its own `<text>` in clear space beside the line.
- Actors: when something travels (a diagram with sends to, feeds, triggers, calls, returns, writes, reads, splits into or merges into), draw it as `<g id="sNN-actor-<what>" data-actor="request|token|packet|message|job|record|event" opacity="0">`, 24–40 px, at most three characters of text, after every node and connector.
- Text: real `<text>`, never below 20 px; break a long label into two `<tspan>` lines rather than shrinking it; nothing runs past its box.
- Allowed elements only: svg, g, defs, path, rect, circle, ellipse, line, polyline, polygon, text, tspan, marker, clipPath, mask, linearGradient, radialGradient, stop, title, desc, use (local `#` references). No `style`, no event attributes, no images, no patterns, no filters.
- Content stays in the safe area; a diagram uses at least 60 % of it.

## Submit

Call `pages_submit_page` with this run directory, the page's `index`, its `form` and its `topology` (a few words: "two panels compared", "pipeline of four stages"). The studio draws the named icons in, checks the page — connector labels and text included — and either keeps it or lists the problems. Fix what it lists and submit again. Stop after it is kept: do not draw another page.
