#!/usr/bin/env python3
"""Check drawn pages against the studio's page contract.

usage: check_pages.py <pages-dir>   → prints a JSON report; exit 1 on any failure.
The studio runs it on each page when the page is submitted.
"""
import json, os, re, sys
import xml.etree.ElementTree as ET

NS = '{http://www.w3.org/2000/svg}'
VERBS = {'sends to', 'waits for', 'calls', 'reads', 'writes', 'returns', 'splits into', 'merges into', 'depends on', 'becomes', 'contains', 'compares with', 'feeds', 'triggers'}
ROLES = {'title', 'list', 'diagram', 'numbers', 'quote', 'close'}
ENTITIES = {'server', 'database', 'cache', 'queue', 'client', 'service'}
ANIMS = {'blink', 'pulse', 'flow', 'fill', 'spin', 'wave'}
MOMENTS = {'establish', 'explain', 'tension', 'consequence', 'resolve', 'aside'}
ACTIONS = {'appear', 'travel', 'spend', 'refill', 'pass', 'reject', 'become', 'highlight', 'leave', 'state'}
# What a drawn object can be asked to show happening to it.
SHOWS = {'spend', 'refill', 'pass', 'reject', 'arrive'}
TRAVELS = {'travel', 'pass', 'reject', 'become'}

# The objects the studio can really draw, and the pieces each one has. The
# same list the studio looks a brief up in: a page may name any of them, and
# a program may address their pieces by name.
def known_objects():
    path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'references', 'objects.json')
    try:
        return {o['entity']: [p['id'] for p in o.get('parts') or []] for o in json.load(open(path)).get('objects') or []}
    except Exception:
        return {}

def object_sizes():
    path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'references', 'objects.json')
    try:
        return {o['entity']: (o['size']['width'], o['size']['height']) for o in json.load(open(path)).get('objects') or [] if o.get('size')}
    except Exception:
        return {}

OBJECTS = known_objects()
SIZES = object_sizes()
# The smallest a drawn object may come out and still carry a scene.
MIN_DRAWN_SIDE = 110

def local(tag):
    return tag.split('}', 1)[1] if '}' in tag else tag


# Where things sit on the page, for the collision checks. Coordinates follow
# translate() transforms; anything under another transform is not placed.
def parents_of(root):
    return {child: parent for parent in root.iter() for child in parent}

def offset_of(el, parents):
    dx = dy = 0.0
    node = el
    while node is not None:
        transform = (node.get('transform') or '').strip()
        if transform:
            m = re.fullmatch(r'translate\(\s*(-?[\d.]+)(?:[\s,]+(-?[\d.]+))?\s*\)', transform)
            if not m:
                return None
            dx += float(m.group(1))
            dy += float(m.group(2) or 0)
        node = parents.get(node)
    return dx, dy

def inherited(el, parents, name, default=None):
    node = el
    while node is not None:
        if node.get(name):
            return node.get(name)
        node = parents.get(node)
    return default

def shape_box(shape, parents):
    off = offset_of(shape, parents)
    if off is None:
        return None
    try:
        tag = local(shape.tag)
        if tag == 'rect':
            x, y = float(shape.get('x') or 0), float(shape.get('y') or 0)
            box = (x, y, x + float(shape.get('width')), y + float(shape.get('height')))
        elif tag == 'circle':
            cx, cy, r = float(shape.get('cx') or 0), float(shape.get('cy') or 0), float(shape.get('r'))
            box = (cx - r, cy - r, cx + r, cy + r)
        elif tag == 'ellipse':
            cx, cy = float(shape.get('cx') or 0), float(shape.get('cy') or 0)
            rx, ry = float(shape.get('rx')), float(shape.get('ry'))
            box = (cx - rx, cy - ry, cx + rx, cy + ry)
        else:
            return None
    except (TypeError, ValueError):
        return None
    return (box[0] + off[0], box[1] + off[1], box[2] + off[0], box[3] + off[1])

def text_boxes(t, root, parents):
    """One box per line of a <text>: its own line and each positioned <tspan>."""
    off = offset_of(t, parents)
    if off is None:
        return []
    try:
        size = float(re.sub(r'[^0-9.]', '', inherited(t, parents, 'font-size', root.get('font-size') or '22')) or 22)
    except ValueError:
        return []
    anchor = inherited(t, parents, 'text-anchor', 'start')
    family = (inherited(t, parents, 'font-family', root.get('font-family') or '') or '').lower()
    # Monospace glyphs are about 0.6 em wide; bold sans about 0.6; regular 0.52.
    per = 0.6 if re.search(r'mono|consolas|courier|menlo', family) else 0.6 if (inherited(t, parents, 'font-weight', '') or '') in ('bold', '600', '700', '800') else 0.52
    lines = []
    try:
        x, y = float(t.get('x') or 0), float(t.get('y') or 0)
    except ValueError:
        return []
    own = (t.text or '').strip()
    if own:
        lines.append((x, y, own))
    for span in [c for c in t if local(c.tag) == 'tspan']:
        words = ''.join(span.itertext()).strip()
        if not words:
            continue
        try:
            sx = float(span.get('x')) if span.get('x') else x
            sy = float(span.get('y')) if span.get('y') else y + float(re.sub(r'[^0-9.-]', '', span.get('dy') or '0') or 0)
        except ValueError:
            continue
        if span.get('x') or span.get('y') or span.get('dy'):
            lines.append((sx, sy, words))
            x, y = sx, sy
        elif lines:
            lx, ly, lw = lines[-1]
            lines[-1] = (lx, ly, lw + words)
        else:
            lines.append((x, y, words))
    boxes = []
    for lx, ly, words in lines:
        width = len(words) * size * per
        left = lx - width / 2 if anchor == 'middle' else lx - width if anchor == 'end' else lx
        boxes.append(((left + off[0], ly - size * 0.78 + off[1], left + width + off[0], ly + size * 0.22 + off[1]), words))
    return boxes

def overlap(a, b):
    return max(0.0, min(a[2], b[2]) - max(a[0], b[0])), max(0.0, min(a[3], b[3]) - max(a[1], b[1]))

def inside(inner, outer, slack=2):
    return inner[0] >= outer[0] - slack and inner[1] >= outer[1] - slack and inner[2] <= outer[2] + slack and inner[3] <= outer[3] + slack

def segments_of(c):
    tag = local(c.tag)
    try:
        if tag == 'line':
            return [(float(c.get('x1') or 0), float(c.get('y1') or 0), float(c.get('x2') or 0), float(c.get('y2') or 0))]
        if tag in ('polyline', 'polygon'):
            nums = [float(v) for v in re.findall(r'-?[\d.]+', c.get('points') or '')]
            pts = list(zip(nums[0::2], nums[1::2]))
            return [(a[0], a[1], b[0], b[1]) for a, b in zip(pts, pts[1:])]
        if tag == 'path':
            d = c.get('d') or ''
            if re.search(r'[CcSsQqTtAa]', d):
                return []
            out, x, y, start = [], 0.0, 0.0, None
            for cmd, args in re.findall(r'([MmLlHhVvZz])([^MmLlHhVvZz]*)', d):
                nums = [float(v) for v in re.findall(r'-?[\d.]+', args)]
                if cmd in 'Mm':
                    pairs = list(zip(nums[0::2], nums[1::2]))
                    if not pairs:
                        continue
                    x, y = (x + pairs[0][0], y + pairs[0][1]) if cmd == 'm' else pairs[0]
                    start = (x, y)
                    for px, py in pairs[1:]:
                        nx, ny = (x + px, y + py) if cmd == 'm' else (px, py)
                        out.append((x, y, nx, ny)); x, y = nx, ny
                elif cmd in 'Ll':
                    for px, py in zip(nums[0::2], nums[1::2]):
                        nx, ny = (x + px, y + py) if cmd == 'l' else (px, py)
                        out.append((x, y, nx, ny)); x, y = nx, ny
                elif cmd in 'Hh':
                    for v in nums:
                        nx = x + v if cmd == 'h' else v
                        out.append((x, y, nx, y)); x = nx
                elif cmd in 'Vv':
                    for v in nums:
                        ny = y + v if cmd == 'v' else v
                        out.append((x, y, x, ny)); y = ny
                elif cmd in 'Zz' and start:
                    out.append((x, y, start[0], start[1])); x, y = start
            return out
    except ValueError:
        return []
    return []

def crosses(seg, box):
    """Does the segment pass through the box's interior (Liang–Barsky)?"""
    x1, y1, x2, y2 = seg
    t0, t1 = 0.0, 1.0
    dx, dy = x2 - x1, y2 - y1
    for p, q in ((-dx, x1 - box[0]), (dx, box[2] - x1), (-dy, y1 - box[1]), (dy, box[3] - y1)):
        if p == 0:
            if q < 0:
                return False
        else:
            r = q / p
            if p < 0:
                t0 = max(t0, r)
            else:
                t1 = min(t1, r)
            if t0 > t1:
                return False
    return (t1 - t0) * (dx * dx + dy * dy) ** 0.5 > 6

FURNITURE = re.compile(r'^\s*§|SHEET\s*\d+\s*/\s*\d+', re.I)

def collisions(root, nodes, connectors):
    """Labels on boxes, labels on labels, lines through boxes (review 5)."""
    problems = []
    parents = parents_of(root)
    chrome = {el for el in root.iter() if el.get('data-role') in ('background', 'header', 'footer', 'decoration')}
    def under(el, group):
        node = el
        while node is not None:
            if node in group:
                return True
            node = parents.get(node)
        return False
    for t in (el for el in root.iter() if local(el.tag) == 'text'):
        words = ''.join(t.itertext()).strip()
        if words and FURNITURE.search(words):
            problems.append(f'page furniture {words[:24]!r} — remove the section eyebrow and sheet number; the video shows every pixel')
    boxes = {}
    for n in nodes:
        shapes = [c for c in n.iter() if local(c.tag) in ('rect', 'ellipse', 'circle') and not c.get('data-appearance-for') and not under(c, {a for a in n.iter() if a.get('data-appearance-for')})]
        box = shape_box(shapes[0], parents) if shapes else None
        if box and box[2] - box[0] > 8 and box[3] - box[1] > 8:
            boxes[n.get('id') or '?'] = (n, box)
    containers = {i for i, (_, a) in boxes.items() if any(j != i and inside(b, a) for j, (_, b) in boxes.items())}
    solid = {i: v for i, v in boxes.items() if i not in containers}
    node_set = set(nodes)
    actors = {el for el in root.iter() if el.get('data-actor')}
    loose, owned = [], []
    for t in (el for el in root.iter() if local(el.tag) == 'text'):
        if under(t, chrome) or under(t, actors):
            continue
        owner = next((n for n in nodes if t in list(n.iter())), None)
        for box, words in text_boxes(t, root, parents):
            if owner is None:
                loose.append((box, words))
            else:
                owned.append((box, words))
            # A node's own words must stay inside its box.
            if owner is not None and owner.get('id') in solid and local([c for c in owner.iter() if local(c.tag) in ('rect', 'ellipse', 'circle')][0].tag) == 'rect':
                nb = solid[owner.get('id')][1]
                mid = (box[1] + box[3]) / 2
                if nb[1] <= mid <= nb[3] and (box[0] < nb[0] - 6 or box[2] > nb[2] + 6):
                    problems.append(f'text {words[:28]!r} spills past the box of {owner.get("id")!r} — shorten it, wrap it in two <tspan> lines, or widen the box')
            for other, (n, nb) in solid.items():
                if n is owner:
                    continue
                w, h = overlap(box, nb)
                if w > 6 and h > 6 and w * h > 0.08 * (box[2] - box[0]) * (box[3] - box[1]):
                    what = 'label' if owner is None else f'text of {owner.get("id")!r}'
                    problems.append(f'{what} {words[:28]!r} sits on node {other!r} — move it into clear space beside its line')
                    break
    for i, (a, wa) in enumerate(loose):
        for b, wb in loose[i + 1:] + owned:
            w, h = overlap(a, b)
            if w > 4 and h > 4:
                problems.append(f'label {wa[:20]!r} overlaps {wb[:20]!r} — move one of them')
    for c in connectors:
        ends = {c.get('data-from'), c.get('data-to')}
        end_boxes = [solid[e][1] for e in ends if e in solid] + [boxes[e][1] for e in ends if e in boxes]
        for seg in segments_of(c):
            for other, (n, nb) in solid.items():
                if other in ends or any(inside(nb, eb) or inside(eb, nb) for eb in end_boxes):
                    continue
                shrunk = (nb[0] + 4, nb[1] + 4, nb[2] - 4, nb[3] - 4)
                if shrunk[2] > shrunk[0] and shrunk[3] > shrunk[1] and crosses(seg, shrunk):
                    problems.append(f'connector {c.get("id")!r} runs through node {other!r} — route it around the box')
                    break
            else:
                continue
            break
    return list(dict.fromkeys(problems))

def check(path):
    problems = []
    raw = open(path, 'rb').read()
    if len(raw) > 40_000:
        problems.append(f'file is {len(raw)} bytes (limit 40000)')
    try:
        root = ET.fromstring(raw)
    except ET.ParseError as error:
        return [f'not well-formed: {error}']
    if local(root.tag) != 'svg':
        return ['root is not <svg>']
    if root.get('viewBox', '').split() != ['0', '0', '1280', '720']:
        problems.append(f"viewBox is {root.get('viewBox')!r}, expected 0 0 1280 720")
    role = root.get('data-page-role', '')
    if role not in ROLES:
        problems.append(f'data-page-role {role!r} is not one of {sorted(ROLES)}')
    ids = {}
    for el in root.iter():
        i = el.get('id')
        if i:
            ids[i] = ids.get(i, 0) + 1
    dupes = [i for i, n in ids.items() if n > 1]
    if dupes:
        problems.append(f'duplicate ids: {dupes[:5]}')
    texts = [el for el in root.iter() if local(el.tag) == 'text']
    if not texts:
        problems.append('no <text> on the page')
    for t in texts:
        size = t.get('font-size') or root.get('font-size') or ''
        try:
            if size and float(re.sub(r'[^0-9.]', '', size)) < 20:
                problems.append(f'text {t.get("id") or (t.text or "")[:20]!r} is {size} (min 20)')
                break
        except ValueError:
            pass
    nodes = [el for el in root.iter() if el.get('data-role') == 'node']
    for n in nodes:
        if not n.get('id'):
            problems.append('a node has no id')
        if not any(local(c.tag) == 'text' for c in n.iter()):
            problems.append(f'node {n.get("id")!r} has no <text>')
        if n.get('data-kind') not in {'box', 'label', 'number', 'quote', 'row'}:
            problems.append(f'node {n.get("id")!r} has data-kind {n.get("data-kind")!r}')
        entity = n.get('data-entity')
        if entity and entity not in ENTITIES:
            problems.append(f'node {n.get("id")!r} data-entity {entity!r} is not one of {sorted(ENTITIES)}')
        obj = n.get('data-object')
        if obj and OBJECTS and obj not in OBJECTS:
            problems.append(f'node {n.get("id")!r} asks for object {obj!r}, which nothing can draw — use one of {sorted(OBJECTS)}')
        if obj and not entity:
            problems.append(f'node {n.get("id")!r} asks for object {obj!r} without saying what it is — add data-entity')
        # A node that stands for a thing in the explanation model carries its
        # stable model id (data-object-id), so the same thing is the same
        # thing on every page. Per-page element ids stay the page's own.
        object_id = n.get('data-object-id')
        if object_id and not re.match(r'^obj-[a-z0-9-]+-\d+$', object_id):
            problems.append(f'node {n.get("id")!r} data-object-id {object_id!r} is not a model object id (obj-…-<n>)')
        shapes = [c for c in n.iter() if local(c.tag) in ('rect', 'ellipse', 'circle')]
        # A drawn object is the subject of its node, and the studio fits it into
        # whichever is roomier: the column beside the words, or the space above
        # them. Work out what the drawing would come out as, the same way.
        if obj and shapes and obj in SIZES:
            labels = [c for c in n.iter() if local(c.tag) == 'text']
            try:
                left = float(shapes[0].get('x') or 0)
                top = float(shapes[0].get('y') or 0)
                width = float(shapes[0].get('width') or 0)
                height = float(shapes[0].get('height') or 0)
                first_x = min(float(t.get('x') or 0) for t in labels) if labels else left + width
                # A text's y is its baseline; its top is about one line above.
                first_y = min(float(t.get('y') or 0) - 22 for t in labels) if labels else top + height
                ow, oh = SIZES[obj]
                beside = (max(24.0, first_x - left - 16), max(24.0, height - 16)) if first_x > left + 24 else (width, height)
                above = (max(24.0, width - 16), max(24.0, first_y - top - 16)) if first_y > top + 24 else None
                fit = lambda room: min(room[0] / ow, room[1] / oh)
                room = above if above and fit(above) > fit(beside) else beside
                drawn = (ow * fit(room), oh * fit(room))
                if min(drawn) < MIN_DRAWN_SIDE:
                    problems.append(
                        f'node {n.get("id")!r} wears a drawn {obj}, but the room it leaves draws it {round(drawn[0])}x{round(drawn[1])} — '
                        f'put the words below the drawing, or give the node a wider column, so it comes out at least {MIN_DRAWN_SIDE} px a side'
                    )
            except (TypeError, ValueError):
                pass
        if entity and shapes:
            labels = [c for c in n.iter() if local(c.tag) == 'text']
            anchored = any((t.get('text-anchor') or '') in ('middle', 'end') for t in labels)
            try:
                left = float(shapes[0].get('x') or 0)
                first = min(float(t.get('x') or 0) for t in labels) if labels else left
                if not anchored and first - left < 56:
                    problems.append(f'entity node {n.get("id")!r} leaves {round(first - left)} px for its picture (needs about 64)')
            except (TypeError, ValueError):
                pass
        if shapes and (shapes[0].get('fill') or '').strip().lower() in ('none', ''):
            problems.append(f'node {n.get("id")!r} has no fill — give its shape the accent at 8 to 12 percent over the ground')
        if entity:
            art = [c for c in n.iter() if c.get('data-appearance-for')]
            if not art:
                problems.append(f'entity node {n.get("id")!r} has no artwork — draw the {entity} as a data-appearance-for group inside it')
            else:
                drawn = [c for c in art[0].iter() if local(c.tag) in ('path', 'rect', 'circle', 'ellipse', 'polygon', 'polyline', 'line')]
                if len(drawn) < 2:
                    problems.append(f'entity node {n.get("id")!r} artwork has {len(drawn)} shape(s) — draw the thing, two to eight shapes')
                if not art[0].get('id'):
                    problems.append(f'entity node {n.get("id")!r} artwork has no id')
                moving = [c for c in art[0].iter() if c.get('data-anim')]
                bad = [c.get('data-anim') for c in moving if c.get('data-anim') not in ANIMS]
                if not moving:
                    problems.append(f'entity node {n.get("id")!r} artwork has no moving part — mark two or three with data-anim ({", ".join(sorted(ANIMS))})')
                if bad:
                    problems.append(f'entity node {n.get("id")!r} artwork has data-anim {bad[:2]} — use one of {sorted(ANIMS)}')
    # Text must fit the shape it sits in: a label wider than its node reads
    # as a drawing mistake in every frame it appears. Width is estimated at
    # 0.52 em per character (0.62 for bold), which is generous for the sans
    # faces the studio ships; only clear overflows are reported.
    for n in nodes:
        rects = [c for c in n.iter() if local(c.tag) in ('rect', 'ellipse', 'circle')]
        if not rects:
            continue
        box = rects[0]
        try:
            width = float(box.get('width') or (float(box.get('rx') or box.get('r') or 0) * 2))
        except (TypeError, ValueError):
            continue
        if width <= 0:
            continue
        for t in n.iter():
            if local(t.tag) != 'text':
                continue
            words = ''.join(t.itertext()).strip()
            if not words:
                continue
            try:
                size = float(re.sub(r'[^0-9.]', '', t.get('font-size') or root.get('font-size') or '22'))
            except ValueError:
                continue
            per = 0.62 if (t.get('font-weight') or '') in ('bold', '600', '700', '800') else 0.52
            estimated = len(words) * size * per
            if estimated > width - 12:
                problems.append(f'text {words[:28]!r} needs about {round(estimated)} px inside a {round(width)} px shape — shorten it, widen the shape, or split it across two <tspan> lines')

    # Two nodes may not sit on top of each other: overlapping cards read as
    # a broken page in every frame, and no amount of motion repairs them.
    placed = []
    for n in nodes:
        shapes = [c for c in n.iter() if local(c.tag) == 'rect']
        if not shapes:
            continue
        try:
            box = (float(shapes[0].get('x')), float(shapes[0].get('y')), float(shapes[0].get('width')), float(shapes[0].get('height')))
        except (TypeError, ValueError):
            continue
        placed.append((n.get('id') or '?', box))
    for i, (id_a, a) in enumerate(placed):
        for id_b, b in placed[i + 1:]:
            wide = min(a[0] + a[2], b[0] + b[2]) - max(a[0], b[0])
            high = min(a[1] + a[3], b[1] + b[3]) - max(a[1], b[1])
            if wide > 4 and high > 4:
                problems.append(f'nodes {id_a!r} and {id_b!r} overlap by {round(wide)}x{round(high)} px — move them apart')

    connectors = [el for el in root.iter() if el.get('data-role') == 'connector']
    problems.extend(collisions(root, nodes, connectors))
    for c in connectors:
        for attr in ('data-from', 'data-to'):
            target = c.get(attr, '')
            if target not in ids:
                problems.append(f'connector {c.get("id")!r} {attr}={target!r} names no element')
        if c.get('data-verb') not in VERBS:
            problems.append(f'connector {c.get("id")!r} verb {c.get("data-verb")!r} is not in the vocabulary')
        if not c.get('id'):
            problems.append('a connector has no id')
    # Anything that travels is an actor of its own: nodes stay where they were
    # drawn, so a page about things moving has to draw the moving thing.
    actors = [el for el in root.iter() if el.get('data-actor')]
    moving = {'sends to', 'feeds', 'triggers', 'calls', 'returns', 'writes', 'reads', 'splits into', 'merges into'}
    if role == 'diagram' and any(c.get('data-verb') in moving for c in connectors) and not actors:
        problems.append('this page moves things between nodes but draws no actor — add a data-actor group for the travelling thing')
    for a in actors:
        if not a.get('id'):
            problems.append('an actor has no id')
        if (a.get('opacity') or '').strip() not in ('0', '0.0'):
            problems.append(f'actor {a.get("id")!r} must start at opacity="0" — the scene brings it on')
        if len(a.get('data-actor', '').split()) != 1:
            problems.append(f'actor {a.get("id")!r} data-actor {a.get("data-actor")!r} should be one lowercase word')
        for parent in nodes:
            if a in list(parent.iter())[1:]:
                problems.append(f'actor {a.get("id")!r} sits inside node {parent.get("id")!r} — actors travel over the page, put them last')
    if role == 'diagram' and len(nodes) < 2:
        problems.append('a diagram page needs at least two nodes')
    if role == 'list' and not nodes:
        problems.append('a list page needs its rows as nodes')
    for el in root.iter():
        tag = local(el.tag)
        if tag in ('image', 'foreignObject', 'style'):
            problems.append(f'<{tag}> is not allowed')
        href = el.get('href') or el.get('{http://www.w3.org/1999/xlink}href')
        if href and not href.startswith('#'):
            problems.append(f'external href {href[:40]!r} is not allowed')
    if not any(el.get('data-role') in ('header', 'background', 'footer') for el in root.iter()):
        problems.append('no chrome group (background / header / footer)')
    return problems

def check_program(path, svg_path):
    """The story the page can tell: every id real, only actors moving."""
    problems = []
    try:
        program = json.load(open(path))
    except Exception as error:
        return [f'program is not readable JSON: {error}']
    root = ET.parse(svg_path).getroot()
    role = root.get('data-page-role') or ''
    ids = {el.get('id') for el in root.iter() if el.get('id')}
    actors = {el.get('id') for el in root.iter() if el.get('data-actor')}
    # What each node wears, so a program can name one of its pieces.
    wears = {el.get('id'): el.get('data-object') for el in root.iter() if el.get('data-object') and el.get('id')}
    parts = {el.get('data-part') for el in root.iter() if el.get('data-part')}

    def names_a_place(where, what, target):
        """An id on the page, or a piece of the object a node wears."""
        if target in ids:
            return
        if '.' in target:
            owner, piece = target.split('.', 1)
            if owner not in ids:
                problems.append(f'{where} {what} {target!r}, but {owner!r} is not on the page')
            elif owner in wears and OBJECTS.get(wears[owner]) is not None and piece not in OBJECTS[wears[owner]] and piece not in parts:
                problems.append(f'{where} {what} {target!r}, but a {wears[owner]} has no {piece!r} — its pieces are {OBJECTS[wears[owner]]}')
            elif owner not in wears and piece not in parts:
                problems.append(f'{where} {what} {target!r}, but {owner!r} wears no drawn object — add data-object to it')
            return
        problems.append(f'{where} {what} {target!r}, which is not on the page')
    beats = program.get('beats') or []
    if len(beats) < (3 if role == 'diagram' else 2):
        problems.append(f'{len(beats)} beat(s) — a scene needs at least {3 if role == "diagram" else 2}')
    for actor in program.get('cast') or []:
        if actor.get('id') not in ids:
            problems.append(f'cast {actor.get("id")!r} is not on the page')
        q = actor.get('quantity')
        if q and q.get('shownOn'):
            names_a_place(f'the quantity of {actor.get("id")!r}', 'is shown on', q['shownOn'])
        # An outcome bound to a piece of the drawn object: the light that comes
        # on when a call goes through, the mark that turns when one is refused.
        for outcome, target in (actor.get('shows') or {}).items():
            if outcome not in SHOWS:
                problems.append(f'cast {actor.get("id")!r} shows {outcome!r}, which is not one of {sorted(SHOWS)}')
            if isinstance(target, str):
                names_a_place(f'cast {actor.get("id")!r}', f'shows {outcome} on', target)
    moments = [b.get('moment') for b in beats]
    for beat in beats:
        where = beat.get('id') or beat.get('moment') or '?'
        if beat.get('moment') not in MOMENTS:
            problems.append(f'beat {where!r} moment {beat.get("moment")!r} is not one of {sorted(MOMENTS)}')
        if not (beat.get('say') or '').strip():
            problems.append(f'beat {where!r} has no say')
        for entry in beat.get('restage') or []:
            if entry.get('id') not in ids:
                problems.append(f'beat {where!r} restages {entry.get("id")!r}, which is not on the page')
            if entry.get('to') and entry.get('to') not in ('left', 'right', 'centre', 'up', 'down'):
                problems.append(f'beat {where!r} sends {entry.get("id")!r} to {entry.get("to")!r} — use left/right/centre/up/down')
            if entry.get('grow') is not None and not (0.2 <= float(entry.get('grow')) <= 3):
                problems.append(f'beat {where!r} grows {entry.get("id")!r} by {entry.get("grow")} — keep it between 0.2 and 3')
            if not any(entry.get(key) for key in ('grow', 'to', 'clear')):
                problems.append(f'beat {where!r} restages {entry.get("id")!r} without saying how')
        camera = beat.get('camera')
        for target in (camera if isinstance(camera, list) else []):
            if target not in ids:
                problems.append(f'beat {where!r} looks at {target!r}, which is not on the page')
        if beat.get('speaker') not in (None, 'me', 'beside', 'page'):
            problems.append(f'beat {where!r} speaker {beat.get("speaker")!r} is not me/beside/page')
        for event in beat.get('events') or []:
            for key in ('actor', 'to'):
                target = event.get(key)
                if target and target not in ids:
                    problems.append(f'beat {where!r} {key} {target!r} is not on the page')
            if event.get('action') not in ACTIONS:
                problems.append(f'beat {where!r} action {event.get("action")!r} is not one of {sorted(ACTIONS)}')
            if event.get('action') in TRAVELS and event.get('actor') not in actors:
                problems.append(f'beat {where!r} moves {event.get("actor")!r}, which is a node — only a data-actor travels, so draw one')
            cue = event.get('cue')
            if cue and cue.lower() not in (beat.get('say') or '').lower():
                problems.append(f'beat {where!r} cue {cue!r} is not a word in its say')
    # A burst is shown, not asserted: spending several units needs several
    # arrivals in the same beat, or the picture and the words disagree.
    for beat in beats:
        where = beat.get('id') or beat.get('moment') or '?'
        events = beat.get('events') or []
        spent = sum(int(e.get('amount') or 1) for e in events if e.get('action') == 'spend')
        arrivals = len([e for e in events if e.get('action') in ('travel', 'pass', 'reject')])
        if spent > 1 and arrivals < 2:
            problems.append(f'beat {where!r} spends {spent} but shows {arrivals} arrival(s) — a burst has to be seen, so send one actor per unit spent')
        # A consequence is cause and outcome in one frame: a close-up that
        # leaves the outcome outside it hides the point of the beat.
        if beat.get('moment') == 'consequence' and isinstance(beat.get('camera'), list) and beat['camera']:
            outcomes = {e.get('to') for e in events if e.get('to')}
            if outcomes and not (outcomes & set(beat['camera'])):
                problems.append(f'beat {where!r} moves in on {beat["camera"]} but its outcome is {sorted(outcomes)} — frame them together')
    if role == 'diagram' and beats and len(set(moments)) < 3:
        problems.append(f'moments are {moments} — a scene needs a shape, not one note repeated')
    if role == 'diagram' and beats and 'consequence' not in moments and 'tension' not in moments:
        problems.append('no tension and no consequence — nothing is at stake in this scene')
    return problems

def main():
    folder = sys.argv[1] if len(sys.argv) > 1 else 'pages'
    files = sorted(f for f in os.listdir(folder) if f.lower().endswith('.svg'))
    report = {'pages': [], 'ok': True}
    for name in files:
        problems = check(os.path.join(folder, name))
        # Scene programs are no longer written (nothing downstream read them);
        # an older deck's program is still checked if it is there.
        program_path = os.path.join(folder, re.sub(r'\.svg$', '.program.json', name, flags=re.I))
        if os.path.exists(program_path):
            problems += [f'program: {p}' for p in check_program(program_path, os.path.join(folder, name))]
        report['pages'].append({'file': name, 'ok': not problems, 'problems': problems})
        if problems:
            report['ok'] = False
    if not files:
        report['ok'] = False
        report['error'] = f'no .svg files in {folder}'
    # The studio writes the deck's spec now; pages no longer carry their own.
    print(json.dumps(report, indent=2))
    sys.exit(0 if report['ok'] else 1)

if __name__ == '__main__':
    main()
