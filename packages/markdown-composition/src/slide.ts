// Slide blocks: an authored SVG page (for example a ppt-master export) that the
// composition inlines and animates step by step. Each step reveals a set of
// named SVG groups with a motion verb; the same driver contract as explainer
// canvases (`window.__explainerDrivers`) exposes step control to the studio.

export type SlideStepVerb = 'reveal' | 'trace' | 'focus'

export type SlideStepV1 = {
  title: string
  explanation: string
  reveals: string[]
  verb: SlideStepVerb
}

export type SlideBlockAttrs = {
  title?: string
  svg?: string
  poster?: string
  source?: string
  steps?: SlideStepV1[]
}

const VERBS: SlideStepVerb[] = ['reveal', 'trace', 'focus']

export const sanitizeSlideSteps = (value: unknown): SlideStepV1[] => {
  if (!Array.isArray(value)) return []
  return value
    .map((raw): SlideStepV1 | null => {
      if (!raw || typeof raw !== 'object') return null
      const step = raw as Record<string, unknown>
      const reveals = Array.isArray(step.reveals)
        ? step.reveals
            .map(id => String(id).trim())
            .filter(id => /^[A-Za-z_][\w.:-]*$/.test(id))
        : []
      const verb = VERBS.includes(step.verb as SlideStepVerb)
        ? (step.verb as SlideStepVerb)
        : 'reveal'
      return {
        title: String(step.title || '').trim().slice(0, 120),
        explanation: String(step.explanation || '').trim().slice(0, 1_200),
        reveals,
        verb,
      }
    })
    .filter((step): step is SlideStepV1 => Boolean(step))
    .slice(0, 24)
}

export const slideStepSeconds = (step: SlideStepV1) => {
  const words = step.explanation.split(/\s+/).filter(Boolean).length
  return Math.min(12, Math.max(3, 1.4 + words / 2.4))
}

export const slideStepOffsets = (steps: SlideStepV1[]) => {
  const offsets: number[] = []
  let at = 0
  for (const step of steps) {
    offsets.push(at)
    at += slideStepSeconds(step)
  }
  return offsets
}

export const slideDurationSeconds = (steps: SlideStepV1[]) =>
  Math.max(5, steps.reduce((total, step) => total + slideStepSeconds(step), 0))

/**
 * Makes authored SVG safe and unique inside a composition: strips scripts,
 * event handlers and foreign objects, drops the root width/height so CSS can
 * size it, and prefixes every id (and reference to one) so many slides can
 * share one document.
 */
export const prepareSlideSvg = (svg: string, prefix: string) => {
  let markup = String(svg || '').trim()
  const start = markup.indexOf('<svg')
  if (start < 0) return ''
  markup = markup.slice(start)
  markup = markup
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
    .replace(/\bjavascript:/gi, '')
  const safe = prefix.replace(/[^A-Za-z0-9_-]/g, '')
  markup = markup
    .replace(/\bid="([^"]+)"/g, (_match, id: string) => `id="${safe}-${id}"`)
    .replace(/url\(#([^)]+)\)/g, (_match, id: string) => `url(#${safe}-${id})`)
    .replace(/\b(xlink:href|href)="#([^"]+)"/g, (_match, attr: string, id: string) => `${attr}="#${safe}-${id}"`)
  markup = markup.replace(/^<svg\b([^>]*)>/, (_match, attrs: string) => {
    const viewBox = /viewBox="\s*([-\d.]+)[\s,]+([-\d.]+)[\s,]+([-\d.]+)[\s,]+([-\d.]+)\s*"/.exec(attrs)
    const width = viewBox ? Number(viewBox[3]) : 0
    const height = viewBox ? Number(viewBox[4]) : 0
    const aspect = width > 0 && height > 0 ? `${width} / ${height}` : '16 / 9'
    const cleaned = attrs
      .replace(/\s(width|height)="[^"]*"/g, '')
      .replace(/\sclass="[^"]*"/, '')
      .replace(/\sstyle="[^"]*"/, '')
    // The aspect ratio travels as a CSS variable so the stylesheet can size the
    // slide to the frame without knowing the page format.
    return `<svg${cleaned} class="slide-svg" style="--slide-aspect: ${aspect}" preserveAspectRatio="xMidYMid meet" focusable="false" aria-hidden="true">`
  })
  return markup
}

export const slidePrefix = (sceneIndex: number) => `s${sceneIndex}`

export const humanizeSlideId = (id: string) =>
  id
    .replace(/^p\d+-/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, character => character.toUpperCase())
    .trim()

/**
 * The in-composition driver. Runs inside the compiled document: measures the
 * strokes of every revealed group once, then paints any (step, progress)
 * state deterministically — for the timeline, the studio's step bar, and the
 * recording coach alike.
 */
export const slideDriverScript = (
  sceneIndex: number,
  sceneId: string,
  steps: SlideStepV1[],
) => {
  const prefix = slidePrefix(sceneIndex)
  const stepData = steps.map(step => ({
    ids: step.reveals.map(id => `${prefix}-${id}`),
    verb: step.verb,
  }))
  const offsets = slideStepOffsets(steps)
  const stepSeconds = steps.map(step => slideStepSeconds(step))
  return `<script data-slide-driver="${sceneIndex}">
(function () {
  var root = document.querySelector('#scene-${sceneIndex} .slide-svg');
  if (!root) return;
  var steps = ${JSON.stringify(stepData)};
  var offsets = ${JSON.stringify(offsets)};
  var stepSeconds = ${JSON.stringify(stepSeconds)};
  // Easing anchors chosen by behaviour: entering, settling, drawing.
  var bezier = function (x1, y1, x2, y2) {
    var sample = function (t, a, b) { return ((1 - 3 * b + 3 * a) * t + (3 * b - 6 * a)) * t * t + 3 * a * t; };
    return function (x) {
      if (x <= 0) return 0; if (x >= 1) return 1;
      var t = x;
      for (var i = 0; i < 8; i += 1) {
        var estimate = sample(t, x1, x2) - x;
        var slope = 3 * (1 - x1 * 3 + x2 * 3) * t * t + 2 * (3 * x1 - 6 * x2 + 3) * t + 3 * x1;
        if (Math.abs(estimate) < 1e-4 || slope === 0) break;
        t -= estimate / slope;
      }
      return sample(Math.max(0, Math.min(1, t)), y1, y2);
    };
  };
  var easeEnter = bezier(0.2, 0.75, 0.34, 0.94);
  var easeSettle = bezier(0, 0.65, 0.51, 0.99);
  var easeDraw = bezier(0.25, 0.6, 0.4, 1);
  var clamp = function (value) { return Math.max(0, Math.min(1, value)); };
  var isStroke = function (node) {
    var tag = node.tagName.toLowerCase();
    if (tag === 'line' || tag === 'polyline') return true;
    return getComputedStyle(node).fill === 'none';
  };
  var targets = steps.map(function (step) {
    return step.ids.map(function (id) {
      var element = document.getElementById(id);
      if (!element || !root.contains(element)) return null;
      var strokes = [];
      var bodies = [];
      element.querySelectorAll('line,polyline,path,text,rect,circle,ellipse,polygon,image').forEach(function (node) {
        if (isStroke(node) && typeof node.getTotalLength === 'function') {
          var length = 0;
          try { length = node.getTotalLength(); } catch (error) { length = 0; }
          if (length > 0) {
            node.style.strokeDasharray = String(length);
            strokes.push({ node: node, length: length });
            return;
          }
        }
        bodies.push(node);
      });
      return { element: element, strokes: strokes, bodies: bodies };
    }).filter(Boolean);
  });
  var settle = function (target, shown, dim) {
    target.element.style.opacity = shown ? String(dim) : '0';
    target.strokes.forEach(function (stroke) { stroke.node.style.strokeDashoffset = '0'; });
    target.bodies.forEach(function (node) { node.style.opacity = ''; node.style.transform = ''; });
  };
  var animate = function (target, progress, verb, index, count) {
    // Stagger from the group's first element; strokes draw before labels.
    var stagger = Math.min(0.12, 0.5 / Math.max(1, count));
    var local = clamp((progress - index * stagger) / Math.max(0.2, 1 - (count - 1) * stagger));
    var strokeProgress = verb === 'trace' ? clamp(local / 0.75) : local;
    var bodyProgress = verb === 'trace' ? clamp((local - 0.45) / 0.55) : local;
    target.element.style.opacity = '1';
    target.strokes.forEach(function (stroke) {
      stroke.node.style.strokeDashoffset = String(stroke.length * (1 - easeDraw(strokeProgress)));
    });
    var lift = 14 * (1 - easeSettle(bodyProgress));
    target.bodies.forEach(function (node) {
      node.style.opacity = String(easeEnter(bodyProgress));
      node.style.transform = lift > 0.05 ? 'translateY(' + lift.toFixed(2) + 'px)' : '';
    });
  };
  var apply = function (stepIndex, progress) {
    var focusDim = steps[stepIndex] && steps[stepIndex].verb === 'focus' ? 0.35 : 1;
    targets.forEach(function (group, index) {
      group.forEach(function (target, position) {
        if (index < stepIndex) settle(target, true, focusDim);
        else if (index > stepIndex) settle(target, false, 1);
        else animate(target, progress, steps[stepIndex].verb, position, group.length);
      });
    });
  };
  window.__slideDrawScene${sceneIndex} = function (sceneTime) {
    var step = 0;
    for (var i = 0; i < offsets.length; i += 1) { if (sceneTime >= offsets[i]) step = i; }
    var window_ = Math.min(1.6, stepSeconds[step] * 0.5);
    apply(step, clamp((sceneTime - offsets[step]) / window_));
  };
  window.__explainerDrivers = window.__explainerDrivers || {};
  window.__explainerDrivers[${JSON.stringify(sceneId)}] = {
    stepCount: offsets.length,
    setStep: function (stepIndex, progress) {
      var clamped = Math.max(0, Math.min(offsets.length - 1, stepIndex));
      apply(clamped, progress == null ? 1 : clamp(progress));
    },
  };
  apply(0, 0);
})();
</script>`
}
