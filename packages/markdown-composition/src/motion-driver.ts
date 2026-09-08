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
  var viewBoxAttr = (root.getAttribute('viewBox') || '').split(/[\\s,]+/).map(Number);
  var pageBox = viewBoxAttr.length === 4 && viewBoxAttr[2] > 0
    ? { x: viewBoxAttr[0], y: viewBoxAttr[1], width: viewBoxAttr[2], height: viewBoxAttr[3] }
    : { x: 0, y: 0, width: 1280, height: 720 };
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
        // Never frame tighter than a third of the page, never beyond it.
        var minW = pageBox.width / 3;
        if (rw < minW) { var cx = rx + rw / 2, cy = ry + rh / 2; rw = minW; rh = minW / aspect; rx = cx - rw / 2; ry = cy - rh / 2; }
        if (rw > pageBox.width) { rx = pageBox.x; ry = pageBox.y; rw = pageBox.width; rh = pageBox.height; }
        rx = Math.max(pageBox.x, Math.min(rx, pageBox.x + pageBox.width - rw));
        ry = Math.max(pageBox.y, Math.min(ry, pageBox.y + pageBox.height - rh));
        entry.rect = { x: rx, y: ry, width: rw, height: rh };
      }
      if (action.op === 'reveal' || action.op === 'trace' || action.op === 'count') {
        entry.targets.forEach(function (t) { t.hiddenAtRest = true; });
      }
      schedule.push(entry);
    });
  });
  schedule.sort(function (a, b) { return a.start - b.start; });

  // ——— fold ———
  var rest = function (t) {
    return { alpha: t.hiddenAtRest ? 0 : 1, dim: 1, scale: 1, dx: 0, dy: 0, trace: 1, body: null, glow: 0, count: null };
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
    for (var i = 0; i < schedule.length; i += 1) {
      var a = schedule[i];
      if (time < a.start) continue;
      var overall = clamp((time - a.start) / a.duration);
      if (!a.state && overall >= 1) continue;
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
          case 'swap':
          case 'morph':
            if (k === 0) s.alpha = 1 - ev; else s.alpha = Math.max(s.alpha, ev);
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
      node.style.transform = transform;
      node.style.filter = s.glow > 0.02 ? 'drop-shadow(0 0 ' + (8 * s.glow).toFixed(1) + 'px ' + accent + ')' : '';
      t.strokes.forEach(function (stroke) { stroke.node.style.strokeDashoffset = String(stroke.length * (1 - s.trace)); });
      t.bodies.forEach(function (leaf) { if (leaf !== node) leaf.style.opacity = s.body === null ? '' : String(s.body); });
      if (t.text) t.text.node.textContent = s.count === null ? t.text.base : format(t.text, s.count);
    });
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
