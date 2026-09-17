// The V2 motion driver — executes a MotionPlanV2 against a live SVG root.
// One ES5 source string, so the exact code the composition embeds is also
// what the studio instantiates for its preview (new Function) and what the
// tests load. The driver is a state fold: every frame starts from the rest
// state (entering targets hidden, camera on the page) and re-applies each
// action up to the requested time in order — state actions persist after
// they finish, flourishes return to the prior value — so seeking anywhere is
// deterministic, for the timeline, the step bar and the renderer alike.
import { MOTION_EASE_ANCHORS, type MotionPlanV2 } from './motion-plan'

export type MotionDriverOptions = { accent?: string; stageTrack?: Array<{ atMs: number; family: string; treatment?: string; variant?: string }> }

export type MotionDriverInstance = {
  stepCount: number
  offsets: number[]
  durationMs: number
  draw: (timeMs: number) => void
  setStep: (stepIndex: number, progress?: number | null) => void
}

// Body of function (root, plan, prefix, options) → MotionDriverInstance.
export const MOTION_DRIVER_SOURCE = `
  var doc = root.ownerDocument || document;
  var options_ = options || {};
  var accent = options_.accent || '#4ade80';
  var anchors = ${JSON.stringify(MOTION_EASE_ANCHORS)};
  var clamp = function (v) { return Math.max(0, Math.min(1, v)); };
  var bezier = function (x1, y1, x2, y2) {
    var sample = function (t, a, b) { return ((1 - 3 * b + 3 * a) * t + (3 * b - 6 * a)) * t * t + 3 * a * t; };
    return function (x) {
      if (x <= 0) return 0; if (x >= 1) return 1;
      var lo = 0, hi = 1, t = x;
      for (var i = 0; i < 24; i += 1) { t = (lo + hi) / 2; if (sample(t, x1, x2) < x) lo = t; else hi = t; }
      return sample(t, y1, y2);
    };
  };
  var eases = {};
  Object.keys(anchors).forEach(function (name) { var a = anchors[name]; eases[name] = bezier(a[0], a[1], a[2], a[3]); });
  var easeOf = function (name) { return eases[name] || eases.settle; };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var escapeId = function (id) {
    if (doc.defaultView && doc.defaultView.CSS && doc.defaultView.CSS.escape) return doc.defaultView.CSS.escape(id);
    return String(id).replace(/([^A-Za-z0-9_-])/g, '\\\\$1');
  };
  var find = function (id) {
    var full = prefix ? prefix + '-' + id : id;
    var node = null;
    try { node = root.querySelector('#' + escapeId(full)); } catch (e) { node = null; }
    if (!node && root.id === full) node = root;
    return node;
  };
  var isStroke = function (node) {
    var tag = node.tagName.toLowerCase();
    if (tag === 'line' || tag === 'polyline') return true;
    var view = doc.defaultView;
    return view ? view.getComputedStyle(node).fill === 'none' : false;
  };
  var bboxOf = function (node) {
    try { var b = node.getBBox(); return { x: b.x, y: b.y, width: b.width, height: b.height }; } catch (e) { return null; }
  };
  var SVG_NS = 'http://www.w3.org/2000/svg';
  // Where a straight line from one box's centre to another's leaves the box.
  var edgePoint = function (box, cx, cy, tx, ty) {
    var dx = tx - cx, dy = ty - cy;
    var sx = dx !== 0 ? (box.width / 2) / Math.abs(dx) : Infinity;
    var sy = dy !== 0 ? (box.height / 2) / Math.abs(dy) : Infinity;
    var s = Math.min(sx, sy, 1);
    return [cx + dx * s, cy + dy * s];
  };
  var viewBoxAttr = (root.getAttribute('viewBox') || '').split(/[\\s,]+/).map(Number);
  var pageBox = viewBoxAttr.length === 4 && viewBoxAttr[2] > 0
    ? { x: viewBoxAttr[0], y: viewBoxAttr[1], width: viewBoxAttr[2], height: viewBoxAttr[3] }
    : { x: 0, y: 0, width: 1280, height: 720 };
  // A page may declare a world larger than its frame (data-world="x y w h"):
  // the camera may travel there; the rest view stays the frame.
  var worldAttr = (root.getAttribute('data-world') || '').split(/[\\s,]+/).map(Number);
  var worldBox = worldAttr.length === 4 && worldAttr[2] > 0 && worldAttr[3] > 0
    ? { x: Math.min(worldAttr[0], pageBox.x), y: Math.min(worldAttr[1], pageBox.y), width: Math.max(worldAttr[2], pageBox.width), height: Math.max(worldAttr[3], pageBox.height) }
    : pageBox;
  var LEAF = 'line,polyline,path,text,rect,circle,ellipse,polygon,image';

  // ——— targets ———
  var targets = {};
  var order = [];
  var register = function (id, node) {
    if (targets[id]) return targets[id];
    if (!node) return null;
    var strokes = [], bodies = [];
    var nodes = node.tagName.toLowerCase() === 'g' ? Array.prototype.slice.call(node.querySelectorAll(LEAF)) : [node];
    nodes.forEach(function (leaf) {
      if (isStroke(leaf) && typeof leaf.getTotalLength === 'function') {
        var length = 0;
        try { length = leaf.getTotalLength(); } catch (e) { length = 0; }
        if (length > 0) { leaf.style.strokeDasharray = String(length); strokes.push({ node: leaf, length: length }); return; }
      }
      bodies.push(leaf);
    });
    var textNode = node.tagName.toLowerCase() === 'text' ? node : node.querySelector ? node.querySelector('text') : null;
    var text = null;
    if (textNode) {
      var raw = textNode.textContent || '';
      var match = /-?\\d[\\d,]*(?:\\.\\d+)?/.exec(raw);
      if (match) {
        var numeric = Number(match[0].replace(/,/g, ''));
        var decimals = (match[0].split('.')[1] || '').length;
        text = { node: textNode, base: raw, value: numeric, decimals: decimals, before: raw.slice(0, match.index), after: raw.slice(match.index + match[0].length), grouped: match[0].indexOf(',') >= 0 };
      }
    }
    var entry = { id: id, node: node, strokes: strokes, bodies: bodies, text: text, hiddenAtRest: false };
    node.style.transformBox = 'fill-box';
    node.style.transformOrigin = 'center';
    targets[id] = entry;
    order.push(entry);
    return entry;
  };

  // ——— schedule ———
  var offsets = [];
  var durationMs = 0;
  plan.steps.forEach(function (b) { offsets.push(durationMs); durationMs += (b.motionWindowMs || 0) + (b.holdMs || 0); });
  var windows = plan.steps.map(function (b) { return b.motionWindowMs || 0; });

  // ——— living diagrams ———
  // A phase op gives a diagram (or an entity) a small program drawn in a
  // layer over the still: packets along the hops of a process (flow, wait,
  // split, merge) or a load bar inside an entity in one of its states. The
  // nouns keep their place; the program is focal during the beat that names
  // it and ambient afterwards, until a later phase replaces it.
  var living = [];
  // Elements whose amount the plan states outright (a quantity's level): the
  // living layer leaves them alone.
  var levelled = {};
  (plan.steps || []).forEach(function (step) {
    (step.actions || []).forEach(function (action) {
      if (action.op !== 'level') return;
      (action.targets || []).forEach(function (id) { levelled[id] = true; });
    });
  });
  var livingLayer = null;
  var layer = function () {
    if (livingLayer) return livingLayer;
    livingLayer = doc.createElementNS(SVG_NS, 'g');
    livingLayer.setAttribute('data-living', '1');
    livingLayer.style.pointerEvents = 'none';
    root.appendChild(livingLayer);
    return livingLayer;
  };
  var levelFor = function (state) {
    var table = { idle: 0.15, empty: 0.05, waiting: 0.3, running: 0.55, flowing: 0.6, reading: 0.6, writing: 0.6, sending: 0.6, busy: 0.75, rejecting: 0.85, loaded: 0.9, 'backed up': 0.9, full: 0.96, failing: 1, served: 1 };
    return table[state] == null ? 0.5 : table[state];
  };
  var livingFor = function (action, value, beatIndex) {
    var program = String(value.program || 'chain');
    var phase = String(value.phase || 'flow');
    var step = plan.steps[beatIndex] || {};
    var beatEnd = offsets[beatIndex] + (step.motionWindowMs || 0) + (step.holdMs || 0);
    var group = doc.createElementNS(SVG_NS, 'g');
    group.setAttribute('data-living-program', program);
    group.setAttribute('data-living-phase', phase);
    group.style.opacity = '0';
    layer().appendChild(group);
    var unit = Math.max(1.5, pageBox.width / 640);
    var token = String(value.token || '').slice(0, 24);
    var item = { key: (action.targets && action.targets[0]) || ('living-' + program + '-' + living.length), program: program, phase: phase, beatEnd: beatEnd, group: group, hops: [], bars: [], details: [], parts: [], unit: unit, token: token, field: [], sweep: null };
    if (program === 'title') {
      // A living title: a slow field of motes across the page and a sweep
      // of light under the top of the page, both ambient.
      for (var f = 0; f < 22; f += 1) {
        var mote = doc.createElementNS(SVG_NS, 'circle');
        var seed = (f * 0.6180339887) % 1, seed2 = (f * 0.7548776662) % 1;
        mote.setAttribute('r', String(unit * (0.8 + seed2 * 1.6)));
        mote.setAttribute('fill', accent);
        mote.style.opacity = '0';
        group.appendChild(mote);
        item.field.push({ node: mote, x: pageBox.x + seed * pageBox.width, y: pageBox.y + seed2 * pageBox.height, drift: 0.6 + seed, phase: seed2 * Math.PI * 2 });
      }
      var sweep = doc.createElementNS(SVG_NS, 'rect');
      sweep.setAttribute('y', String(pageBox.y + pageBox.height * 0.2));
      sweep.setAttribute('height', String(unit * 1.2));
      sweep.setAttribute('width', String(pageBox.width * 0.22));
      sweep.setAttribute('rx', String(unit * 0.6));
      sweep.setAttribute('fill', accent);
      sweep.style.opacity = '0';
      group.appendChild(sweep);
      item.sweep = sweep;
      living.push(item);
      return item;
    }
    if (program === 'entity') {
      var kind = String(value.kind || 'thing');
      (action.targets || []).forEach(function (id) {
        var node = find(id); var box = node && bboxOf(node); if (!box) return;
        // The page draws the thing and says which of its parts move. Those
        // parts are the animation; the generic accents below are only for a
        // page that declared none. The marked parts may sit on the thing's
        // own element or on an ancestor group that holds its artwork.
        var scope = node, marked = [];
        for (var up = 0; up < 3 && scope && scope.querySelectorAll; up += 1) {
          marked = Array.prototype.slice.call(scope.querySelectorAll('[data-anim]'));
          if (marked.length) break;
          scope = scope.parentNode;
        }
        if (marked.length) {
          marked.slice(0, 12).forEach(function (part) {
            // A part the plan drives by amount is not ambient decoration: an
            // authored level wins over the living layer's own idea of fullness.
            if (part.id && levelled[part.id]) return;
            var partBox = bboxOf(part);
            if (!partBox) return;
            part.style.transformBox = 'fill-box';
            part.style.transformOrigin = 'center';
            item.parts.push({
              node: part,
              how: String(part.getAttribute('data-anim') || '').toLowerCase(),
              order: Number(part.getAttribute('data-anim-order')) || 0,
              rate: String(part.getAttribute('data-anim-rate') || ''),
              box: partBox,
              rest: part.style.opacity === '' ? 1 : Number(part.style.opacity),
              width: partBox.width,
            });
          });
          return;
        }
        // A thing moves like the kind of thing it is: a server blinks, a
        // store pulses, a queue moves items through, a client radiates. The
        // parts are drawn once here and animated every frame below.
        var detail = { kind: kind, lights: [], rings: [], items: [], box: box };
        var padding = unit * 2.4;
        if (kind === 'server' || kind === 'service') {
          for (var li = 0; li < 3; li += 1) {
            var light = doc.createElementNS(SVG_NS, 'circle');
            light.setAttribute('r', String(unit * 1.5));
            light.setAttribute('cx', String(box.x + box.width - padding));
            light.setAttribute('cy', String(box.y + padding + li * unit * 4.2));
            light.setAttribute('fill', accent);
            light.style.opacity = '0';
            group.appendChild(light);
            detail.lights.push(light);
          }
        } else if (kind === 'database' || kind === 'cache') {
          for (var ri = 0; ri < 2; ri += 1) {
            var ring = doc.createElementNS(SVG_NS, 'ellipse');
            ring.setAttribute('cx', String(box.x + padding * 1.6));
            ring.setAttribute('cy', String(box.y + box.height / 2));
            ring.setAttribute('rx', String(unit * 4));
            ring.setAttribute('ry', String(unit * 1.6));
            ring.setAttribute('fill', 'none');
            ring.setAttribute('stroke', accent);
            ring.setAttribute('stroke-width', String(unit * 0.8));
            ring.style.opacity = '0';
            group.appendChild(ring);
            detail.rings.push(ring);
          }
        } else if (kind === 'queue') {
          for (var qi = 0; qi < 3; qi += 1) {
            var slot = doc.createElementNS(SVG_NS, 'rect');
            slot.setAttribute('width', String(unit * 2.6));
            slot.setAttribute('height', String(unit * 3.4));
            slot.setAttribute('rx', String(unit * 0.6));
            slot.setAttribute('y', String(box.y + box.height / 2 - unit * 1.7));
            slot.setAttribute('fill', accent);
            slot.style.opacity = '0';
            group.appendChild(slot);
            detail.items.push(slot);
          }
        } else if (kind === 'client') {
          for (var ci = 0; ci < 2; ci += 1) {
            var arc = doc.createElementNS(SVG_NS, 'circle');
            arc.setAttribute('cx', String(box.x + padding * 1.4));
            arc.setAttribute('cy', String(box.y + padding * 1.2));
            arc.setAttribute('r', String(unit * 2));
            arc.setAttribute('fill', 'none');
            arc.setAttribute('stroke', accent);
            arc.setAttribute('stroke-width', String(unit * 0.7));
            arc.style.opacity = '0';
            group.appendChild(arc);
            detail.rings.push(arc);
          }
        }
        item.details.push(detail);
        var h = Math.max(2, Math.min(box.height * 0.12, unit * 3));
        var track = doc.createElementNS(SVG_NS, 'rect');
        track.setAttribute('x', String(box.x + unit)); track.setAttribute('y', String(box.y + box.height - h - unit));
        track.setAttribute('height', String(h)); track.setAttribute('width', String(Math.max(0, box.width - unit * 2))); track.setAttribute('rx', String(h / 2));
        track.setAttribute('fill', accent); track.style.opacity = '0.18';
        group.appendChild(track);
        var bar = doc.createElementNS(SVG_NS, 'rect');
        bar.setAttribute('x', String(box.x + unit)); bar.setAttribute('y', String(box.y + box.height - h - unit));
        bar.setAttribute('height', String(h)); bar.setAttribute('width', '0'); bar.setAttribute('rx', String(h / 2));
        bar.setAttribute('fill', phase === 'failing' || phase === 'rejecting' ? '#ef4444' : accent);
        group.appendChild(bar);
        item.bars.push({ bar: bar, width: Math.max(0, box.width - unit * 2), level: levelFor(phase) });
      });
      living.push(item);
      return item;
    }
    String(value.hops || '').split(';').forEach(function (part) {
      if (!part) return;
      var pieces = part.split(':'); var ends = (pieces[1] || '').split('>');
      var fromNode = find(ends[0]), toNode = find(ends[1]);
      var a = fromNode && bboxOf(fromNode), b = toNode && bboxOf(toNode);
      if (!a || !b) return;
      var ax = a.x + a.width / 2, ay = a.y + a.height / 2, bx = b.x + b.width / 2, by = b.y + b.height / 2;
      var hop = { from: edgePoint(a, ax, ay, bx, by), to: edgePoint(b, bx, by, ax, ay), packets: [], ring: null };
      var count = phase === 'wait' ? 1 : 2;
      for (var i = 0; i < count; i += 1) {
        if (i === 0 && token) {
          // The thing that travels, named: a pill with the word on it.
          var pill = doc.createElementNS(SVG_NS, 'g');
          var textNode = doc.createElementNS(SVG_NS, 'text');
          textNode.textContent = token;
          textNode.setAttribute('font-size', String(unit * 4.6));
          textNode.setAttribute('font-family', 'Inter, ui-sans-serif, system-ui, sans-serif');
          textNode.setAttribute('font-weight', '600');
          textNode.setAttribute('fill', '#0b0f17');
          textNode.setAttribute('dominant-baseline', 'middle');
          textNode.setAttribute('text-anchor', 'middle');
          var pillW = unit * (4.6 * 0.6 * token.length + 7), pillH = unit * 7;
          var back = doc.createElementNS(SVG_NS, 'rect');
          back.setAttribute('x', String(-pillW / 2)); back.setAttribute('y', String(-pillH / 2));
          back.setAttribute('width', String(pillW)); back.setAttribute('height', String(pillH)); back.setAttribute('rx', String(pillH / 2));
          back.setAttribute('fill', accent);
          pill.appendChild(back); pill.appendChild(textNode);
          pill.style.opacity = '0';
          group.appendChild(pill);
          hop.packets.push({ node: pill, pill: true });
          continue;
        }
        var dot = doc.createElementNS(SVG_NS, 'circle');
        dot.setAttribute('r', String(unit * 2.2)); dot.setAttribute('fill', accent); dot.style.opacity = '0';
        group.appendChild(dot); hop.packets.push({ node: dot, pill: false });
      }
      var ring = doc.createElementNS(SVG_NS, 'rect');
      ring.setAttribute('x', String(b.x - unit)); ring.setAttribute('y', String(b.y - unit));
      ring.setAttribute('width', String(b.width + unit * 2)); ring.setAttribute('height', String(b.height + unit * 2));
      ring.setAttribute('rx', String(unit * 2)); ring.setAttribute('fill', 'none'); ring.setAttribute('stroke', accent); ring.setAttribute('stroke-width', String(unit)); ring.style.opacity = '0';
      group.appendChild(ring); hop.ring = ring;
      item.hops.push(hop);
    });
    living.push(item);
    return item;
  };
  var drawLiving = function (activeLiving) {
    living.forEach(function (item) { if (!activeLiving[item.key] || activeLiving[item.key].item !== item) item.group.style.opacity = '0'; });
    Object.keys(activeLiving).forEach(function (key) {
      var run = activeLiving[key], item = run.item, local = run.local;
      item.group.style.opacity = String(clamp(run.amp * run.fade));
      item.bars.forEach(function (bar) {
        var grow = eases.settle(clamp(local / 900));
        var wobble = item.phase === 'running' || item.phase === 'busy' || item.phase === 'flowing' ? 0.04 * Math.sin(local / 260) : 0;
        bar.bar.setAttribute('width', String(Math.max(0, bar.width * Math.min(1, bar.level + wobble) * grow)));
      });
      // The thing the page drew, moving by its own marked parts.
      item.parts.forEach(function (part) {
        var busy = levelFor(item.phase);
        var slow = part.rate === 'slow' ? 2.2 : part.rate === 'fast' ? 0.55 : 1;
        var period = (1500 + (1 - busy) * 1800) * slow;
        var t = (local + part.order * period * 0.28) / period;
        var cycle = t - Math.floor(t);
        var node = part.node;
        switch (part.how) {
          case 'blink':
            node.style.opacity = String(clamp(0.18 + 0.82 * Math.max(0, Math.sin(cycle * Math.PI * 2))) * (0.45 + 0.55 * busy));
            break;
          case 'pulse':
            node.style.transform = 'scale(' + (1 + 0.09 * busy * Math.sin(cycle * Math.PI * 2)).toFixed(4) + ')';
            node.style.opacity = String(clamp(part.rest * (0.72 + 0.28 * Math.sin(cycle * Math.PI * 2))));
            break;
          case 'flow':
            node.style.transform = 'translateX(' + (part.box.width * (cycle - 0.5) * 1.8).toFixed(2) + 'px)';
            node.style.opacity = String(clamp(Math.sin(Math.PI * cycle) * (0.4 + 0.6 * busy)));
            break;
          case 'fill':
            var grow = eases.settle(clamp(local / 900)) * busy;
            node.style.transformOrigin = 'left center';
            node.style.transform = 'scaleX(' + Math.max(0.02, grow).toFixed(3) + ')';
            node.style.opacity = String(part.rest);
            break;
          case 'spin':
            node.style.transform = 'rotate(' + ((local / (period * 2.4)) * 360 % 360).toFixed(1) + 'deg)';
            break;
          case 'wave':
            node.style.transform = 'scale(' + (1 + cycle * 1.6 * (0.5 + busy)).toFixed(3) + ')';
            node.style.opacity = String(clamp((1 - cycle) * (0.25 + 0.6 * busy)));
            break;
          default:
            break;
        }
      });
      // The generic accents, for a page that named no moving parts.
      item.details.forEach(function (detail) {
        var busy = levelFor(item.phase);
        var rate = 340 + (1 - busy) * 900;
        detail.lights.forEach(function (light, index) {
          var wave = Math.sin((local / rate) - index * 0.9);
          light.style.opacity = String(clamp(0.22 + 0.62 * Math.max(0, wave)) * (item.phase === 'idle' ? 0.5 : 1));
          if (item.phase === 'failing') light.setAttribute('fill', Math.sin(local / 220) > 0 ? '#ef4444' : accent);
        });
        detail.rings.forEach(function (ring, index) {
          var cycle = ((local / (1100 + index * 260)) % 1);
          var grow = 1 + cycle * (detail.kind === 'client' ? 1.9 : 0.55);
          ring.style.opacity = String(clamp((1 - cycle) * (0.16 + 0.5 * busy)));
          if (detail.kind === 'client') ring.setAttribute('r', String(item.unit * 2 * grow));
          else { ring.setAttribute('rx', String(item.unit * 4 * grow)); ring.setAttribute('ry', String(item.unit * 1.6 * grow)); }
        });
        detail.items.forEach(function (slot, index) {
          var span = detail.box.width - item.unit * 8;
          var u = (((local / (item.phase === 'backed up' ? 3600 : 1500)) + index / detail.items.length) % 1);
          slot.setAttribute('x', String(detail.box.x + item.unit * 4 + span * u));
          slot.style.opacity = String(clamp(Math.sin(Math.PI * u) * (0.35 + 0.5 * busy)));
        });
      });
      if (item.program === 'title') {
        // Motes drift on slow circles; the sweep crosses under the title
        // once every six seconds and rests between crossings.
        item.field.forEach(function (mote, index) {
          var t = local / 1000;
          var x = mote.x + Math.sin(t * 0.25 * mote.drift + mote.phase) * item.unit * 14;
          var y = mote.y + Math.cos(t * 0.19 * mote.drift + mote.phase) * item.unit * 10;
          mote.node.setAttribute('cx', x.toFixed(1)); mote.node.setAttribute('cy', y.toFixed(1));
          mote.node.style.opacity = String(0.18 + 0.16 * Math.sin(t * 0.7 + index));
        });
        if (item.sweep) {
          var cycle = (local % 6000) / 6000;
          var visible = cycle < 0.45;
          var progress = clamp(cycle / 0.45);
          var eased = eases.camera(progress);
          item.sweep.setAttribute('x', String(pageBox.x - pageBox.width * 0.22 + eased * pageBox.width * 1.22));
          item.sweep.style.opacity = visible ? String(0.35 * Math.sin(Math.PI * progress)) : '0';
        }
        return;
      }
      var n = item.hops.length;
      item.hops.forEach(function (hop, index) {
        var peak = 0;
        var breathe = item.program === 'cluster';
        hop.packets.forEach(function (packet, k) {
          var dot = packet.node;
          var u, on = !breathe;
          if (item.phase === 'wait') {
            var pos = (local % (Math.max(1, n) * 1300)) / 1300;
            on = Math.floor(pos) === index;
            u = pos - Math.floor(pos);
          } else if (item.program === 'network') {
            // Traffic both ways, each hop on its own phase.
            var phaseShift = ((index * 0.6180339887) % 1) * 1600;
            u = (((local + phaseShift) / 1600) + k / hop.packets.length) % 1;
            if (k % 2 === 1) u = 1 - u;
          } else {
            var shift = item.phase === 'split' || item.phase === 'merge' ? 0 : index * 180;
            u = (((local + shift) / 1600) + k / hop.packets.length) % 1;
          }
          if (!on) { dot.style.opacity = '0'; return; }
          var px = hop.from[0] + (hop.to[0] - hop.from[0]) * u, py = hop.from[1] + (hop.to[1] - hop.from[1]) * u;
          if (packet.pill) dot.setAttribute('transform', 'translate(' + px.toFixed(2) + ' ' + py.toFixed(2) + ')');
          else { dot.setAttribute('cx', px.toFixed(2)); dot.setAttribute('cy', py.toFixed(2)); }
          dot.style.opacity = String(clamp(Math.sin(Math.PI * u) * (run.amp > 0.9 ? 1 : 0.7)));
          if (u > 0.82) peak = Math.max(peak, (u - 0.82) / 0.18);
        });
        if (hop.ring) hop.ring.style.opacity = String(breathe ? clamp(0.22 + 0.22 * Math.sin(local / 600 + index)) : clamp(peak * (item.phase === 'wait' ? 0.9 : 0.5)));
      });
    });
  };
  var schedule = [];
  var synth = 0;
  plan.steps.forEach(function (beat, beatIndex) {
    (beat.actions || []).forEach(function (action) {
      var start = offsets[beatIndex] + (action.startMs || 0);
      var value = action.value || {};
      var entry = { op: action.op, start: start, duration: Math.max(1, action.duration || action.durationMs || 1), ease: easeOf(action.ease), state: action.persistence !== 'flourish', value: value, targets: [], stagger: Number(value.staggerMs) || 0, rect: null };
      if (action.op === 'connect' && action.ports && (!action.targets || !action.targets.length)) {
        var from = find(action.ports.from), to = find(action.ports.to);
        var a = from && bboxOf(from), b = to && bboxOf(to);
        if (a && b) {
          var ax = a.x + a.width / 2, ay = a.y + a.height / 2, bx = b.x + b.width / 2, by = b.y + b.height / 2;
          var clip = function (box, cx, cy, tx, ty) {
            var dx = tx - cx, dy = ty - cy;
            var sx = dx !== 0 ? (box.width / 2) / Math.abs(dx) : Infinity;
            var sy = dy !== 0 ? (box.height / 2) / Math.abs(dy) : Infinity;
            var s = Math.min(sx, sy, 1);
            return [cx + dx * s, cy + dy * s];
          };
          var p1 = clip(a, ax, ay, bx, by), p2 = clip(b, bx, by, ax, ay);
          var path = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
          synth += 1;
          var synthId = 'syn-' + synth;
          path.setAttribute('id', prefix ? prefix + '-' + synthId : synthId);
          path.setAttribute('d', 'M ' + p1[0] + ' ' + p1[1] + ' L ' + p2[0] + ' ' + p2[1]);
          path.setAttribute('fill', 'none');
          path.setAttribute('stroke', accent);
          path.setAttribute('stroke-width', String(Math.max(1.5, pageBox.width / 640)));
          path.setAttribute('stroke-linecap', 'round');
          path.setAttribute('data-motion-synth', '1');
          root.appendChild(path);
          var t = register(synthId, path);
          if (t) { t.hiddenAtRest = true; entry.targets.push(t); }
        }
      } else if (action.op === 'phase') {
        entry.living = livingFor(action, value, beatIndex);
      } else {
        (action.targets || []).forEach(function (id) {
          var t = register(id, find(id));
          if (t) entry.targets.push(t);
        });
      }
      if (action.op === 'camera' && typeof value.width === 'number' && value.width > 0) {
        var pad = typeof value.padding === 'number' ? value.padding : Math.max(value.width, value.height) * 0.12;
        var rx = value.x - pad, ry = value.y - pad, rw = value.width + pad * 2, rh = value.height + pad * 2;
        var aspect = pageBox.width / pageBox.height;
        if (rw / rh < aspect) { var nw = rh * aspect; rx -= (nw - rw) / 2; rw = nw; } else { var nh = rw / aspect; ry -= (nh - rh) / 2; rh = nh; }
        // Never frame tighter than a third of the page, never beyond the
        // world (the page itself unless it declared a larger one).
        var minW = pageBox.width / 3;
        if (rw < minW) { var cx = rx + rw / 2, cy = ry + rh / 2; rw = minW; rh = minW / aspect; rx = cx - rw / 2; ry = cy - rh / 2; }
        if (rw > worldBox.width || rh > worldBox.height) { rx = pageBox.x; ry = pageBox.y; rw = pageBox.width; rh = pageBox.height; }
        rx = Math.max(worldBox.x, Math.min(rx, worldBox.x + worldBox.width - rw));
        ry = Math.max(worldBox.y, Math.min(ry, worldBox.y + worldBox.height - rh));
        entry.rect = { x: rx, y: ry, width: rw, height: rh };
      }
      if (action.op === 'reveal' || action.op === 'trace' || action.op === 'count') {
        entry.targets.forEach(function (t) { t.hiddenAtRest = true; });
      }
      // A level is a shape the page already drew: it is never hidden at rest,
      // and it scales from the edge it fills from rather than its middle.
      if (action.op === 'level') {
        entry.targets.forEach(function (t) {
          var box = t.node.getBBox ? t.node.getBBox() : null;
          t.levelAxis = !box || box.width >= box.height ? 'x' : 'y';
          t.node.style.transformBox = 'fill-box';
          t.node.style.transformOrigin = t.levelAxis === 'x' ? 'left center' : 'center bottom';
        });
      }
      if ((action.op === 'morph' || action.op === 'swap') && Number(value.fromCount) > 0) {
        entry.targets.forEach(function (t, index) { if (index >= Number(value.fromCount)) t.hiddenAtRest = true; });
      }
      schedule.push(entry);
    });
  });
  schedule.sort(function (a, b) { return a.start - b.start; });

  // ——— fold ———
  var rest = function (t) {
    return { alpha: t.hiddenAtRest ? 0 : 1, dim: 1, scale: 1, dx: 0, dy: 0, trace: 1, body: null, glow: 0, count: null, level: null };
  };
  var format = function (text, value) {
    var fixed = Math.abs(value).toFixed(text.decimals);
    if (text.grouped) fixed = fixed.replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',');
    return text.before + (value < 0 ? '-' : '') + fixed + text.after;
  };
  var draw = function (timeMs) {
    var time = Math.max(0, Number(timeMs) || 0);
    var states = {};
    order.forEach(function (t) { states[t.id] = rest(t); });
    var camera = { x: pageBox.x, y: pageBox.y, width: pageBox.width, height: pageBox.height };
    var activeLiving = {};
    for (var i = 0; i < schedule.length; i += 1) {
      var a = schedule[i];
      if (time < a.start) continue;
      var overall = clamp((time - a.start) / a.duration);
      if (!a.state && overall >= 1) continue;
      if (a.op === 'phase') {
        // The latest phase on a diagram wins; focal in its beat, ambient after.
        if (a.living) activeLiving[a.living.key] = { item: a.living, local: time - a.start, amp: time < a.living.beatEnd ? 1 : 0.42, fade: overall };
        continue;
      }
      if (a.op === 'camera') {
        var target = a.rect || pageBox;
        var e = a.ease(overall);
        camera = { x: lerp(camera.x, target.x, e), y: lerp(camera.y, target.y, e), width: lerp(camera.width, target.width, e), height: lerp(camera.height, target.height, e) };
        continue;
      }
      var count = a.targets.length;
      var spread = a.stagger * Math.max(0, count - 1);
      var each = Math.max(1, a.duration - spread);
      for (var k = 0; k < count; k += 1) {
        var t = a.targets[k];
        var s = states[t.id];
        var p = clamp((time - a.start - a.stagger * k) / each);
        var ev = a.ease(p);
        switch (a.op) {
          case 'reveal':
            s.alpha = Math.max(s.alpha, ev); s.dy = 14 * (1 - eases.settle(p)); break;
          case 'trace':
            s.alpha = 1; s.trace = eases.draw(clamp(p / 0.75)); s.body = eases.enter(clamp((p - 0.45) / 0.55)); break;
          case 'connect':
            s.alpha = 1; s.trace = eases.draw(p); s.body = 1; break;
          case 'count':
            s.alpha = Math.max(s.alpha, ev);
            if (t.text) { var from = typeof a.value.from === 'number' ? a.value.from : 0; var to = typeof a.value.to === 'number' ? a.value.to : t.text.value; s.count = lerp(from, to, ev); }
            break;
          case 'exit':
            s.alpha = 1 - ev; s.dy = 10 * ev; break;
          case 'dim':
            s.dim = lerp(s.dim, typeof a.value.to === 'number' ? a.value.to : 0.35, ev); break;
          case 'undim':
            s.dim = lerp(s.dim, 1, ev); break;
          case 'emphasize':
            if (a.state) { s.scale *= 1 + 0.04 * ev; s.glow = Math.max(s.glow, ev); }
            else { var bell = Math.sin(Math.PI * p); s.scale *= 1 + 0.06 * bell; s.glow = Math.max(s.glow, bell); }
            break;
          case 'pulse':
            s.scale *= 1 + 0.05 * Math.abs(Math.sin(Math.PI * 2 * p)) * (1 - p * 0.5); s.glow = Math.max(s.glow, Math.abs(Math.sin(Math.PI * 2 * p)) * (1 - p)); break;
          case 'move':
            s.dx += (Number(a.value.dx) || 0) * ev; s.dy += (Number(a.value.dy) || 0) * ev; break;
          case 'resize':
            // Made bigger on purpose, and it stays that way.
            s.scale *= lerp(1, typeof a.value.to === 'number' ? a.value.to : 1, ev); break;
          case 'level':
            // How full the thing is: the bar the page drew, scaled along its
            // own longer side, from the edge it fills from.
            var lf = typeof a.value.from === 'number' ? a.value.from : 1;
            var lt = typeof a.value.to === 'number' ? a.value.to : 1;
            s.level = Math.max(0, lerp(lf, lt, ev)); break;
          case 'swap':
          case 'morph':
            // The first fromCount targets fade out as the rest fade in.
            var fromCount = Number(a.value.fromCount) > 0 ? Number(a.value.fromCount) : 1;
            if (k < fromCount) s.alpha = Math.min(s.alpha, 1 - ev); else s.alpha = Math.max(s.alpha, ev);
            break;
          default: break;
        }
      }
    }
    order.forEach(function (t) {
      var s = states[t.id];
      var node = t.node;
      node.style.opacity = String(clamp(s.alpha * s.dim));
      var transform = '';
      if (Math.abs(s.dx) > 0.05 || Math.abs(s.dy) > 0.05) transform += 'translate(' + s.dx.toFixed(2) + 'px, ' + s.dy.toFixed(2) + 'px)';
      if (Math.abs(s.scale - 1) > 0.001) transform += (transform ? ' ' : '') + 'scale(' + s.scale.toFixed(4) + ')';
      if (s.level !== null) transform += (transform ? ' ' : '') + (t.levelAxis === 'y' ? 'scaleY(' : 'scaleX(') + s.level.toFixed(4) + ')';
      node.style.transform = transform;
      node.style.filter = s.glow > 0.02 ? 'drop-shadow(0 0 ' + (8 * s.glow).toFixed(1) + 'px ' + accent + ')' : '';
      t.strokes.forEach(function (stroke) { stroke.node.style.strokeDashoffset = String(stroke.length * (1 - s.trace)); });
      t.bodies.forEach(function (leaf) { if (leaf !== node) leaf.style.opacity = s.body === null ? '' : String(s.body); });
      if (t.text) t.text.node.textContent = s.count === null ? t.text.base : format(t.text, s.count);
    });
    drawLiving(activeLiving);
    root.setAttribute('viewBox', camera.x.toFixed(2) + ' ' + camera.y.toFixed(2) + ' ' + camera.width.toFixed(2) + ' ' + camera.height.toFixed(2));
  };
  var setStep = function (stepIndex, progress) {
    var index = Math.max(0, Math.min(offsets.length - 1, stepIndex | 0));
    var p = progress == null ? 1 : clamp(progress);
    draw(offsets[index] + p * Math.max(1, windows[index]));
  };
  return { stepCount: offsets.length, offsets: offsets, durationMs: durationMs, draw: draw, setStep: setStep };
`

/** Builds a driver on a live root (studio preview, tests). */
export const instantiateMotionDriver = (
  root: SVGSVGElement,
  plan: MotionPlanV2,
  prefix = '',
  options: MotionDriverOptions = {},
): MotionDriverInstance =>
  new Function('root', 'plan', 'prefix', 'options', MOTION_DRIVER_SOURCE)(
    root,
    plan,
    prefix,
    options,
  ) as MotionDriverInstance

/** The in-composition script: same driver, wired to the scene's svg. */
export const motionDriverScript = (
  sceneIndex: number,
  sceneId: string,
  plan: MotionPlanV2,
  prefix: string,
  options: MotionDriverOptions = {},
) => `<script data-slide-driver="${sceneIndex}">
(function () {
  var root = document.querySelector('#scene-${sceneIndex} .slide-svg');
  if (!root) return;
  var create = function (root, plan, prefix, options) {${MOTION_DRIVER_SOURCE}};
  var plan = ${JSON.stringify(plan)};
  var driver = create(root, plan, ${JSON.stringify(prefix)}, ${JSON.stringify({ accent: options.accent })});
  // The stage: who owns the frame at this moment. A live override on the
  // scene element wins over the track.
  var scene = document.getElementById('scene-${sceneIndex}');
  var track = ${JSON.stringify(options.stageTrack || [])};
  var applyStage = function (ms) {
    if (!scene) return;
    var override = scene.getAttribute('data-stage-override');
    var family = override || '', treatment = '', variant = override ? (scene.getAttribute('data-stage-override-variant') || '') : '';
    if (!override) {
      for (var i = 0; i < track.length; i += 1) { if (track[i].atMs <= ms) { family = track[i].family; treatment = track[i].treatment || ''; variant = track[i].variant || ''; } }
      if (!family && track.length) { family = track[0].family; treatment = track[0].treatment || ''; variant = track[0].variant || ''; }
    }
    if (!family) return;
    if (scene.getAttribute('data-stage') !== family) scene.setAttribute('data-stage', family);
    if ((scene.getAttribute('data-stage-treatment') || '') !== treatment) {
      if (treatment) scene.setAttribute('data-stage-treatment', treatment); else scene.removeAttribute('data-stage-treatment');
    }
    if ((scene.getAttribute('data-stage-variant') || '') !== variant) {
      if (variant) scene.setAttribute('data-stage-variant', variant); else scene.removeAttribute('data-stage-variant');
    }
  };
  window.__slideDrawScene${sceneIndex} = function (sceneTime) { driver.draw(sceneTime * 1000); applyStage(sceneTime * 1000); };
  window.__explainerDrivers = window.__explainerDrivers || {};
  window.__explainerDrivers[${JSON.stringify(sceneId)}] = {
    stepCount: driver.stepCount,
    setStep: function (stepIndex, progress) {
      driver.setStep(stepIndex, progress);
      var index = Math.max(0, Math.min(driver.offsets.length - 1, stepIndex | 0));
      applyStage(driver.offsets[index] + (progress == null ? 1 : progress) * (plan.steps[index] && plan.steps[index].motionWindowMs || 0));
    },
    stage: { track: track, apply: applyStage, current: function () { return scene ? scene.getAttribute('data-stage') : null; } },
  };
  driver.draw(0);
  applyStage(0);
})();
</script>`
