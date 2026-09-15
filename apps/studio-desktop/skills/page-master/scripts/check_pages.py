#!/usr/bin/env python3
"""Check drawn pages against the studio's page contract.

usage: check_pages.py <pages-dir>   → prints a JSON report; exit 1 on any failure.
"""
import json, os, re, sys
import xml.etree.ElementTree as ET

NS = '{http://www.w3.org/2000/svg}'
VERBS = {'sends to', 'waits for', 'calls', 'reads', 'writes', 'returns', 'splits into', 'merges into', 'depends on', 'becomes', 'contains', 'compares with', 'feeds', 'triggers'}
ROLES = {'title', 'list', 'diagram', 'numbers', 'quote', 'close'}

def local(tag):
    return tag.split('}', 1)[1] if '}' in tag else tag

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

    connectors = [el for el in root.iter() if el.get('data-role') == 'connector']
    for c in connectors:
        for attr in ('data-from', 'data-to'):
            target = c.get(attr, '')
            if target not in ids:
                problems.append(f'connector {c.get("id")!r} {attr}={target!r} names no element')
        if c.get('data-verb') not in VERBS:
            problems.append(f'connector {c.get("id")!r} verb {c.get("data-verb")!r} is not in the vocabulary')
        if not c.get('id'):
            problems.append('a connector has no id')
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

def main():
    folder = sys.argv[1] if len(sys.argv) > 1 else 'pages'
    files = sorted(f for f in os.listdir(folder) if f.lower().endswith('.svg'))
    report = {'pages': [], 'ok': True}
    for name in files:
        problems = check(os.path.join(folder, name))
        report['pages'].append({'file': name, 'ok': not problems, 'problems': problems})
        if problems:
            report['ok'] = False
    if not files:
        report['ok'] = False
        report['error'] = f'no .svg files in {folder}'
    print(json.dumps(report, indent=2))
    sys.exit(0 if report['ok'] else 1)

if __name__ == '__main__':
    main()
