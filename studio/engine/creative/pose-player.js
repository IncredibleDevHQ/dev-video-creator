/*
 * The app's pose player for drawn artwork, installed into a production as
 * compositions/artwork-poses.js. Quiver drew each pose of a drawing by
 * editing the drawing itself, shape for shape, so every shape a pose changes
 * carries that pose's values (data-pose-<pose>) in a form a tween reads
 * number for number:
 *
 *   artworkPose(tl, 'rate-limiter', 'limit', 3.2, 0.9)
 *   artworkPose(tl, 'rate-limiter', 'rest', 7, 0.8)
 *
 * tweens the drawing into a pose at a second of the timeline, and back. A
 * pose is a whole state of the drawing: what it does not change returns to
 * rest. Everything is a GSAP tween or set on the scene's own timeline, so it
 * seeks like the rest of the scene.
 */
;(function () {
  'use strict'
  var PREFIX = 'data-pose-'
  function camel(name) {
    return name.replace(/-([a-z])/g, function (_, letter) {
      return letter.toUpperCase()
    })
  }
  function read(element, pose) {
    var text = element.getAttribute(PREFIX + pose)
    if (!text) return null
    try {
      return JSON.parse(text)
    } catch (error) {
      return null
    }
  }
  function poseNames(element) {
    var names = []
    for (var i = 0; i < element.attributes.length; i++) {
      var name = element.attributes[i].name
      if (name.indexOf(PREFIX) === 0) names.push(name.slice(PREFIX.length))
    }
    return names
  }
  // A shape at rest: what any of its poses changes, as the drawing has it.
  // Read once, before the timeline has moved anything.
  function rest(element) {
    if (element.__poseRest) return element.__poseRest
    var values = { attr: {}, snap: {}, style: {}, snapStyle: {} }
    var names = poseNames(element)
    for (var i = 0; i < names.length; i++) {
      var pose = read(element, names[i]) || {}
      var key
      for (key in pose.attr || {})
        values.attr[key] = element.getAttribute(key) || ''
      for (key in pose.snap || {})
        values.snap[key] = element.getAttribute(key) || ''
      for (key in pose.style || {})
        values.style[key] =
          element.style.getPropertyValue(key) ||
          window.getComputedStyle(element).getPropertyValue(key)
      for (key in pose.snapStyle || {})
        values.snapStyle[key] = element.style.getPropertyValue(key)
    }
    element.__poseRest = values
    return values
  }
  function any(map) {
    for (var key in map) return true
    return false
  }
  function css(map) {
    var vars = {}
    for (var key in map) vars[camel(key)] = map[key]
    return vars
  }
  function assign(target, source) {
    for (var key in source) target[key] = source[key]
    return target
  }
  var DRAWN = 'matrix(1 0 0 1 0 0)'
  // The layer a pop scales: the next in turn that this timeline does not
  // already pop at that time, so pops that overlap on one timeline never
  // share a layer, whatever order the scene builds them in.
  function layerFor(root, tl, layers, from, to) {
    var taken = tl.__posePops || (tl.__posePops = [])
    var mine = []
    var i, j
    for (j = 0; j < taken.length; j++)
      if (taken[j][0] === root) mine.push(taken[j])
    // A timeline built anew starts the drawing's layers as drawn, though an
    // older one was left in the middle of a pop.
    if (!mine.length)
      for (i = 0; i < layers.length; i++)
        layers[i].setAttribute('transform', DRAWN)
    var turn = root.__posePops || 0
    var pick = turn % layers.length
    for (i = 0; i < layers.length; i++) {
      var index = (turn + i) % layers.length
      var clash = false
      for (j = 0; j < mine.length; j++)
        if (mine[j][1] === index && from < mine[j][3] && mine[j][2] < to)
          clash = true
      if (!clash) {
        pick = index
        break
      }
    }
    root.__posePops = pick + 1
    taken.push([root, pick, from, to])
    return layers[pick]
  }
  // The middle of a drawing in its own units, where its pop swells from: its
  // frame's, else its content's as the scene is built, so every seek agrees.
  function middle(art, content) {
    var box = (art.getAttribute('viewBox') || '').trim().split(/[\s,]+/)
    var x = +box[0],
      y = +box[1],
      width = +box[2],
      height = +box[3]
    if (box.length === 4 && width > 0 && height > 0 && isFinite(x + y))
      return [x + width / 2, y + height / 2]
    try {
      var drawn = content.getBBox()
      if (drawn.width > 0 && drawn.height > 0)
        return [drawn.x + drawn.width / 2, drawn.y + drawn.height / 2]
    } catch (error) {}
    return null
  }

  /**
   * Tween the drawing placed for `entity` into `pose` ('rest' for the
   * drawing as drawn) on timeline `tl`, from second `at` for `seconds`
   * (0.8 by default). Returns tl.
   *
   * As a Lottie state change does: the change runs through the drawing's
   * shapes one after another rather than all at once, a part that turns or
   * moves overshoots a little and settles (`ease` overrides both), and the
   * drawing gives a small pop as it arrives in a new state. It all ends
   * within `seconds`.
   */
  window.artworkPose = function (tl, entity, pose, at, seconds, ease) {
    var root = document.querySelector('[data-artwork="' + entity + '"]')
    if (!root || !tl) return tl
    var shapes = root.querySelectorAll('[data-posed]')
    var duration = typeof seconds === 'number' && seconds >= 0 ? seconds : 0.8
    var start = typeof at === 'number' ? at : tl.duration()
    // The cascade spreads over at most half the change, inside it: a later
    // shape starts later and takes less, so the last arrives on time.
    var stagger =
      shapes.length > 1
        ? Math.min(0.05, (duration * 0.5) / (shapes.length - 1))
        : 0
    var each = duration - stagger * Math.max(0, shapes.length - 1)
    var i
    for (i = 0; i < shapes.length; i++) rest(shapes[i])
    for (i = 0; i < shapes.length; i++) {
      var element = shapes[i]
      var home = rest(element)
      var target = (pose !== 'rest' && read(element, pose)) || home
      var when = start + i * stagger
      var attr = assign(assign({}, home.attr), target.attr || {})
      var style = assign(assign({}, home.style), target.style || {})
      // Only a turn or a move overshoots: a colour must not.
      var turns =
        attr.transform !== undefined &&
        Object.keys(attr).length === 1 &&
        !any(style)
      var vars = {
        duration: each,
        ease: ease || (turns ? 'back.out(1.7)' : 'power2.inOut')
      }
      if (any(attr)) vars.attr = attr
      assign(vars, css(style))
      if (vars.attr || any(style)) tl.to(element, vars, when)
      // What cannot tween changes halfway through.
      var snap = assign(assign({}, home.snap), target.snap || {})
      var snapStyle = css(
        assign(assign({}, home.snapStyle), target.snapStyle || {})
      )
      if (any(snap))
        tl.set(element, { attr: snap, immediateRender: false }, when + each / 2)
      if (any(snapStyle))
        tl.set(
          element,
          assign({ immediateRender: false }, snapStyle),
          when + each / 2
        )
    }
    // The pop: the drawing swells a touch about its middle and settles as it
    // arrives, inside the change. It scales one of the layers the app put
    // around the drawing's content, which nothing else moves, from the
    // drawing as drawn and back, with numbers fixed here: a scale the scene
    // gives the drawing stays, pops that overlap add up, and every seek of
    // the timeline shows the same frame.
    var art = root.querySelector('svg')
    var layers = root.querySelectorAll('[data-pose-pop] [data-pose-layer]')
    var beat = Math.min(0.2, duration * 0.2)
    var centre =
      art && layers.length && shapes.length && pose !== 'rest' && beat > 0
        ? middle(art, layers[0])
        : null
    if (centre) {
      var from = start + duration * 0.6
      tl.fromTo(
        layerFor(root, tl, layers, from, from + 2 * beat),
        { attr: { transform: DRAWN } },
        {
          attr: {
            transform:
              'matrix(1.04 0 0 1.04 ' +
              +(-0.04 * centre[0]).toFixed(4) +
              ' ' +
              +(-0.04 * centre[1]).toFixed(4) +
              ')'
          },
          duration: beat,
          ease: 'power1.out',
          yoyo: true,
          repeat: 1,
          immediateRender: false
        },
        from
      )
    }
    return tl
  }
})()
