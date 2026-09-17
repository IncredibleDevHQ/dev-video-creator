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

### What the thing IS

A node that stands for a kind of thing says so with `data-entity`:

```xml
<g id="s03-node-rate-limiter" data-role="node" data-kind="box" data-entity="service">
```

`data-entity` is one of `server`, `database`, `cache`, `queue`, `client`, `service`. Declare it whenever the node is one of those — a limiter, a shedder, an API or a handler is a `service`; Redis is a `cache`; a bucket of state is a `database`; a backlog is a `queue`; the caller is a `client`.

The studio dresses a declared thing with its picture from the video's asset library (one picture per thing, reused on every page that names it) and gives it its own motion: a server blinks, a store pulses, a queue moves items through, a client radiates, and the busier its state in the narration the faster it runs.

### Draw the thing

You draw it. A node that declares `data-entity` carries its own artwork, drawn by you as vector in the page's palette, in a group that names the node it dresses:

```xml
<g id="s03-node-rate-limiter" data-role="node" data-kind="box" data-entity="service">
  <rect id="s03-node-rate-limiter-box" x="480" y="300" width="300" height="104" rx="12"
        fill="#635bff" fill-opacity="0.10" stroke="#635bff" stroke-opacity="0.55" stroke-width="1.5"/>
  <g id="s03-node-rate-limiter-art" data-appearance-for="s03-node-rate-limiter">
    <!-- 44×44 of real drawing: a gate, a dial, a valve — whatever this thing is -->
  </g>
  <text x="556" y="345" font-size="24" fill="#e5edf5">Rate limiter</text>
  <text x="556" y="375" font-size="18" fill="#8fa3bd">paces each user's requests</text>
</g>
```

Rules for the artwork:

- One `data-appearance-for` group per entity node, its own `id`, drawn inside the node's box with about 44 px a side, vertically centred at the node's left inset 16 px. The label and its detail then start at least 64 px from the node's left edge.
- Real drawing, not a letter in a circle: a server is a stack of racks with status lights, a database a cylinder, a cache a lightning bolt in a chip, a queue a row of slots with an arrow, a client a person at a screen, a service a hexagon with a gear or a valve. Two to eight shapes each, stroke 2–2.5 at the node's scale, the page's accent for the strokes and the accent at 12–18 % for any fill.
- No `<image>`, no external reference: the artwork is part of the page.

### Ask for the real thing

Some things the studio can draw properly — a real object, rigged into pieces it
can move one at a time. **When a node is one of them, say so.** A page about a
bucket that never asks for the bucket gets a wireframe where it could have had
the thing itself. A node says which one with `data-object`:

```xml
<g id="s04-node-slot-pool" data-role="node" data-kind="box" data-entity="queue" data-object="slot-pool">
```

The objects and their pieces are listed in `references/objects.json`
(`token-bucket`, `server`, `request`, `slot-pool`, `waiting-line` — each with
its own named parts). Declaring one does three things:

- the studio draws that object and fits it into the node's box, standing your
  own drawing down rather than deleting it;
- the program may address one of its pieces by name — `s04-node-slot-pool.occupied`
  — wherever it names an element (`quantity.shownOn`, `shows`);
- a page that names an object nobody can draw fails the check.

**Leave it room.** A drawn object is the subject of its node, not a badge in
the corner: a node that declares `data-object` starts its words at least
**120 px** from the node's left edge, and is at least 300 px wide and 140 px
tall, so the drawing has a column it can read in. Plan the page around that —
a diagram usually has one or two such nodes, and they are the ones the story is
about. The studio refuses to wear a drawing that would come out under 48 px a
side; that node keeps its wireframe and the author is told which one to widen.

Declare it only where the name is right — a node that is not one of these
objects says nothing. The drawing is filed under what was asked for, so the
same object named on five pages is drawn once and reused.

Your own `data-appearance-for` artwork stays required either way: it is what the
page reads as until the drawing arrives, and what it falls back to if it never
does.

### Make the thing live

The studio animates the parts you name. Mark the pieces of your artwork that should move with `data-anim`, and the thing lives on the page — no external animation file, no video: the drawing you made moves.

| `data-anim` | What the studio does | Use it for |
|---|---|---|
| `blink` | fades the part in and out in sequence with its siblings | status lights on a rack, LEDs, indicators |
| `pulse` | breathes the part's scale and brightness from its own centre | a core, a heart, a processor, a disc |
| `flow` | slides the part along its own width, looping, fading in and out at the ends | tokens in a bucket, items in a queue, packets in a pipe |
| `fill` | grows the part from zero to the level the narration implies | a meter, a gauge, a bucket's contents, a load bar |
| `spin` | turns the part about its own centre | a gear, a dial, a fan, a cog |
| `wave` | ripples the part outward and fades it | a signal, a broadcast, a radiating client |

Add `data-anim-order="0|1|2…"` to stagger siblings, and `data-anim-rate="slow|fast"` when a part should be calmer or busier than its neighbours. Every marked part must be a real drawn element inside the artwork group. Two or three moving parts per thing is right; ten is noise.

The studio reveals the artwork with the thing it dresses, never counts it as ink of its own, runs the marked parts whenever the narration is about that thing, and keeps them running quietly afterwards — faster the busier the state the line implies (idle, running, loaded, failing …). A thing with no marked parts still gets the studio's generic accents, which is the poorer look.

**Fill the shape.** Every node's shape carries a real fill (the accent at 8–12 % over the ground), never `fill="none"`.

## Connectors (the relations)

```xml
<line id="s<NN>-edge-<i>" data-role="connector" data-verb="<verb>"
      data-from="s<NN>-node-<a>" data-to="s<NN>-node-<b>"
      x1 y1 x2 y2 stroke="…" stroke-width="1.5" marker-end="url(#s<NN>-arrow)"/>
```

A `<path>` is allowed instead of a `<line>` when the route bends. `data-from` and `data-to` name existing node ids; `data-verb` is one of: `sends to`, `waits for`, `calls`, `reads`, `writes`, `returns`, `splits into`, `merges into`, `depends on`, `becomes`, `contains`, `compares with`, `feeds`, `triggers`. Define one arrowhead marker per page, `id="s<NN>-arrow"`, inside `<defs>`.

## Actors (the things that move)

Nodes never drift. A node is a place on the page; once the reader has learned
where it is, having it slide around under the narration destroys the
arrangement. A scene may still recompose the page on purpose — enlarge the
thing it is about, send two outcomes to opposite sides, clear away what has
done its job — but that is a decision the program states (`restage`), and the
things keep their identity through it.

What a node must never be is a stand-in for something in motion. When the
narration says something *travels* — a request arrives, a token is spent, a
packet crosses the wire — the page draws that travelling thing as its own small
actor, separate from every node:

```xml
<g id="s<NN>-actor-request" data-actor="request" opacity="0">
  <circle cx="…" cy="…" r="14" fill="…"/>
  <text x="…" y="…" font-size="20" text-anchor="middle" fill="…">req</text>
</g>
```

Rules for actors:

- `data-actor` names what it is: `request`, `token`, `packet`, `message`, `job`,
  `record`, `event`. One word, lowercase.
- It starts at `opacity="0"`, parked at the place it comes from. The scene brings
  it on; the page never shows it at rest.
- It is small — 24–40 px across — and carries at most three characters of text.
  It must read at a glance while moving.
- It sits at the top of the document, after every node and connector, so it
  travels over the diagram rather than under it.
- Draw one per travelling thing the narration names, not one per hop. The same
  actor makes every trip.
- Actors are the only thing a scene moves as part of its story. A node moves
  only where the program restages the page, never to act something out.

## Text

Real `<text>` elements only. The smallest text on the page is 20 px; labels inside nodes 22–26 px; the title 34–44 px. No text overflows its box; break long labels into two `<tspan>` lines rather than shrinking below 20 px.

## Never

No node standing in for something in motion (draw an actor instead), no `<image>`, no external `href`, no `<style>` blocks with classes the studio cannot see (inline attributes only), no `<foreignObject>`, no glyph outlines, no filters heavier than a soft drop shadow.

## Safe area

Content lives inside x 80–1200, y 120–660. Chrome may touch the edges. A diagram uses at least 60 % of the safe area's width and height.
