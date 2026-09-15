# The page contract

What the studio reads from a page. Every attribute below is a fact the atomiser believes before it measures anything; a page that states them is animated exactly as drawn.

## Root

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" width="1280" height="720"
     font-family="<body font>, Inter, sans-serif" font-size="22"
     data-page-role="<title|list|diagram|numbers|quote|close>" data-page-index="<NN>">
```

## Ids

Every element the narration may name has a stable id prefixed by the scene: `s<NN>-…`. Ids are unique in the file, lowercase, hyphenated (`s03-node-rate-limiter`, `s03-edge-2`, `s03-row-1`). Never reuse an id.

## Chrome (drawn, never animated)

Groups with `data-role="background"`, `data-role="header"`, `data-role="footer"`, `data-role="decoration"`. The grid, the frame, the eyebrow, the footer badge live here. On `list`, `diagram` and `numbers` pages the page title is `<text id="s<NN>-title">` inside the header group (it is read, not animated).

On `title`, `close` and `quote` pages there is no separate content: the title, the support line and the source are the subject. Put them in a group `data-role="node" data-kind="label"` (one node per line: `s<NN>-node-title`, `s<NN>-node-support`), never in the header, so the narration can land on them.

## Nodes (the things the narration names)

```xml
<g id="s<NN>-node-<slug>" data-role="node" data-kind="box">
  <rect …/>                      <!-- one shape: rect, circle, ellipse, path -->
  <text …>Rate limiter</text>    <!-- one label, the words the narration uses -->
</g>
```

`data-kind` is one of `box`, `label`, `number`, `quote`, `row`. A list row is a node with `data-kind="row"` holding its number badge, its label and its detail text. A number page's figure is a node with `data-kind="number"` whose digits are one `<text>` with a single `<tspan>`.

## Connectors (the relations)

```xml
<line id="s<NN>-edge-<i>" data-role="connector" data-verb="<verb>"
      data-from="s<NN>-node-<a>" data-to="s<NN>-node-<b>"
      x1 y1 x2 y2 stroke="…" stroke-width="1.5" marker-end="url(#s<NN>-arrow)"/>
```

A `<path>` is allowed instead of a `<line>` when the route bends. `data-from` and `data-to` name existing node ids; `data-verb` is one of: `sends to`, `waits for`, `calls`, `reads`, `writes`, `returns`, `splits into`, `merges into`, `depends on`, `becomes`, `contains`, `compares with`, `feeds`, `triggers`. Define one arrowhead marker per page, `id="s<NN>-arrow"`, inside `<defs>`.

## Text

Real `<text>` elements only. The smallest text on the page is 20 px; labels inside nodes 22–26 px; the title 34–44 px. No text overflows its box; break long labels into two `<tspan>` lines rather than shrinking below 20 px.

## Never

No `<image>`, no external `href`, no `<style>` blocks with classes the studio cannot see (inline attributes only), no `<foreignObject>`, no glyph outlines, no filters heavier than a soft drop shadow.

## Safe area

Content lives inside x 80–1200, y 120–660. Chrome may touch the edges. A diagram uses at least 60 % of the safe area's width and height.
