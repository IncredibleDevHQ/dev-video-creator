# Draw Pages — runtime authority

## Inputs

`motion/inputs.json` in the project directory:

- `video`: `{ title, site }`
- `brand`: `{ palette: { ground, text, accent, secondary }, fonts: { display, body, mono }, mode }`
- `scenes[]`: `{ index, title, kind, seconds, idea, narration, parts[{ kind, label, detail }], relations[{ from, to, verb }] }`
- `contract`: a reminder of the rules; the full text is `references/page-contract.md`

Kinds: `title`, `list`, `diagram`, `numbers`, `quote`, `close`.

## Procedure

1. **Read the inputs once.** Note the palette and the fonts; every page uses them and nothing else. Dark mode means the ground is the dark colour and text is light.
2. **For each scene, decide the page before drawing it** (one paragraph of thought, not a file):
   - `title` / `close`: the title large, one line of support, the site small. Nothing else. The title and the support line are nodes (`data-kind="label"`), not header chrome — see the contract.
   - `list`: one row per part, numbered, label plus detail, generous rhythm, the rows fill the safe area.
   - `numbers`: each part a figure (the digits large, single `<tspan>`) with its caption; two to four across.
   - `quote`: the words large and centred, the source small.
   - Whenever a node stands for a server, a store, a cache, a queue, a client or a service, declare it with `data-entity` **and draw that thing** as vector artwork inside the node (see the contract). A page of identical labelled rectangles is a failed page; the reader should recognise the things before reading a word.
   - `diagram`: resolve the relationship atoms (order, link, parent, membership, contrast) of `relations` into ONE topology per ppt-master's grammar (`executor-structure.md` §1–§3): spine → nodes → connectors → labels → garnish. A chain of `waits for` is a single reading path; `splits into` fans out from a hub; `merges into` converges; `contains` nests; `compares with` sets peers on a shared baseline. Never a grid of equal boxes with straight arrows by default; let the topology shape the page. Fill the safe area; no box narrower than its label plus padding; no text under 20 px.
3. **Draw** `pages/NN_<slug>.svg` for every scene (`NN` = two-digit 1-based index, slug = lowercase title words joined by `-`, max five words), following `references/page-contract.md` exactly. Write real SVG text (`<text>`), never outlined glyphs, never raster images, never external references. Keep each file under 40 KB.
4. **Check** all pages: `python3 ${SKILL_DIR}/scripts/check_pages.py pages` — fix every reported failure and run it again until it passes.
5. **Write** `pages/receipt.json`: `{ "pages": [{ "file", "index", "title", "kind", "topology": "<one phrase>", "checks": "pass" }], "notes": "<anything the author should know>" }`.
6. Stop. Do not open the notebook, do not plan motion, do not ask questions.

## Style (the blueprint look the studio uses)

- Canvas `viewBox="0 0 1280 720"`, ground filled with the palette ground, a faint grid (lines at 1–2 % opacity) as decoration.
- Header: eyebrow `§ NN · VIDEO TITLE` in the mono font, small, the accent colour; the page title in the display font, 34–44 px, bold, light text.
- Footer: the site and `SHEET NN / TOTAL` in small mono type, bottom right.
- Nodes: rounded rectangles (rx 12) with a 1.5 px stroke in the accent at ~55 % and a real translucent fill (the accent at 8–12 % over the ground — never `fill="none"`), the label in the body font at 22–26 px with its detail line beneath at 17–19 px in the muted colour.
- A node that is a kind of thing carries `data-entity` **and its own drawing**: a `data-appearance-for` group of real vector art, about 44 px, at the node's left, with the words starting 64 px in (see the contract). Draw the thing, do not label it.
- The page is not flat: the hero of the page reads first (a heavier stroke, a stronger fill, or a soft accent glow), supporting nodes sit back, and chrome is quiet. One accent, used where it means something.
- Connectors: 1.5–2 px lines in the accent at 60 % opacity, with an arrowhead marker; a short verb label near the middle when it helps.
- Emphasis with the accent; secondary colour for contrast only.
