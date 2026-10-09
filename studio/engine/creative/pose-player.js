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
  /**
   * Tween the drawing placed for `entity` into `pose` ('rest' for the
   * drawing as drawn) on timeline `tl`, from second `at` for `seconds`
   * (0.8 by default). Returns tl.
   *
   * As a Lottie state change does: the change runs through the drawing's
   * shapes one after another rather than all at once, and a part that turns
   * or moves overshoots a little and settles (`ease` overrides both). It all
   * ends within `seconds`.
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
    return tl
  }
})()
