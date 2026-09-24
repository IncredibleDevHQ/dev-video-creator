// The part of visual-cast extraction that needs a real SVG renderer. It runs
// inside a headless Chrome page (see visual-cast.ts): the base page is laid
// out as the browser draws it, so bounds include every transform, stroke and
// marker, and every extracted ingredient is rasterised beside the same
// elements rendered in place on the original page.
//
// Kept as plain JavaScript in a string: code handed to the page must not
// depend on the bundler's helpers.
export const CAST_PAGE_SCRIPT = String.raw`
(async function (input) {
  var NS = 'http://www.w3.org/2000/svg'
  // Attributes a wrapper must carry so a lifted element looks as it did.
  var INHERITED = ['transform', 'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-miterlimit', 'opacity', 'font-family', 'font-size', 'font-weight', 'font-style', 'letter-spacing', 'text-anchor', 'dominant-baseline', 'clip-rule', 'color', 'paint-order', 'shape-rendering', 'clip-path', 'mask', 'filter', 'style']
  var FURNITURE = ['background', 'header', 'footer', 'decoration']
  var GAP = 12

  function load(svgText, width, height) {
    return new Promise(function (resolve) {
      var image = new Image()
      image.onload = function () {
        var canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.ceil(width))
        canvas.height = Math.max(1, Math.ceil(height))
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height)
        resolve(canvas)
      }
      image.onerror = function () { resolve(null) }
      image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText)
    })
  }
  function painted(canvas) {
    var data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data
    var minX = Infinity, minY = Infinity, maxX = -1, maxY = -1, count = 0
    for (var y = 0; y < canvas.height; y++) {
      for (var x = 0; x < canvas.width; x++) {
        if (data[(y * canvas.width + x) * 4 + 3] > 8) {
          count++
          if (x < minX) minX = x
          if (y < minY) minY = y
          if (x > maxX) maxX = x
          if (y > maxY) maxY = y
        }
      }
    }
    return count ? { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1, count: count } : { x: 0, y: 0, width: 0, height: 0, count: 0 }
  }
  function difference(a, b) {
    if (!a || !b || a.width !== b.width || a.height !== b.height) return { ratio: 1, differing: -1 }
    var da = a.getContext('2d').getImageData(0, 0, a.width, a.height).data
    var db = b.getContext('2d').getImageData(0, 0, b.width, b.height).data
    var differing = 0, considered = 0
    for (var i = 0; i < da.length; i += 4) {
      if (da[i + 3] > 8 || db[i + 3] > 8) considered++
      if (Math.abs(da[i] - db[i]) > 24 || Math.abs(da[i + 1] - db[i + 1]) > 24 || Math.abs(da[i + 2] - db[i + 2]) > 24 || Math.abs(da[i + 3] - db[i + 3]) > 24) differing++
    }
    return { ratio: considered ? differing / considered : 0, differing: differing }
  }
  function png(canvas) { return canvas ? canvas.toDataURL('image/png').split(',')[1] : '' }
  function scaled(canvas, max) {
    if (!canvas) return null
    var factor = Math.min(1, max / Math.max(canvas.width, canvas.height))
    var out = document.createElement('canvas')
    out.width = Math.max(1, Math.round(canvas.width * factor))
    out.height = Math.max(1, Math.round(canvas.height * factor))
    out.getContext('2d').drawImage(canvas, 0, 0, out.width, out.height)
    return out
  }
  function rectOf(element, origin) {
    var box = element.getBoundingClientRect()
    return { x: box.left - origin.left, y: box.top - origin.top, width: box.width, height: box.height }
  }
  function near(a, b) {
    return a.x - GAP <= b.x + b.width && b.x - GAP <= a.x + a.width && a.y - GAP <= b.y + b.height && b.y - GAP <= a.y + a.height
  }
  function union(boxes) {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    boxes.forEach(function (box) {
      minX = Math.min(minX, box.x); minY = Math.min(minY, box.y)
      maxX = Math.max(maxX, box.x + box.width); maxY = Math.max(maxY, box.y + box.height)
    })
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
  }
  // Every id an element (or what it points at) needs: url(#…) and #href.
  function referencedIds(element, into) {
    var walk = function (node) {
      for (var i = 0; i < node.attributes.length; i++) {
        var attribute = node.attributes[i]
        var urls = attribute.value.match(/url\(\s*['"]?#([^)'"\s]+)['"]?\s*\)/g) || []
        urls.forEach(function (url) { into.add(url.replace(/^url\(\s*['"]?#/, '').replace(/['"]?\s*\)$/, '')) })
        if ((attribute.name === 'href' || attribute.name === 'xlink:href') && attribute.value.charAt(0) === '#') into.add(attribute.value.slice(1))
      }
      for (var j = 0; j < node.children.length; j++) walk(node.children[j])
    }
    walk(element)
    return into
  }
  function withDefinitions(svg, members) {
    var ids = new Set()
    members.forEach(function (member) { referencedIds(member, ids) })
    var found = []
    var seen = new Set()
    var queue = Array.from(ids)
    while (queue.length) {
      var id = queue.shift()
      if (seen.has(id)) continue
      seen.add(id)
      var target = svg.querySelector('[id="' + CSS.escape(id) + '"]')
      if (!target || members.some(function (member) { return member.contains(target) })) continue
      found.push(target)
      referencedIds(target, new Set()).forEach(function (next) { if (!seen.has(next)) queue.push(next) })
    }
    return found
  }
  function strip(root) {
    root.querySelectorAll('script, foreignObject, image').forEach(function (element) { element.remove() })
    var all = [root].concat(Array.from(root.querySelectorAll('*')))
    all.forEach(function (element) {
      Array.from(element.attributes).forEach(function (attribute) {
        var name = attribute.name.toLowerCase()
        if (name.indexOf('on') === 0) element.removeAttribute(attribute.name)
        if ((name === 'href' || name === 'xlink:href') && attribute.value.charAt(0) !== '#') element.removeAttribute(attribute.name)
      })
    })
  }
  function prefixIds(root, prefix) {
    var all = [root].concat(Array.from(root.querySelectorAll('*')))
    all.forEach(function (element) {
      if (element.id) element.id = prefix + element.id
      Array.from(element.attributes).forEach(function (attribute) {
        var value = attribute.value
        var next = value.replace(/url\(\s*['"]?#([^)'"\s]+)['"]?\s*\)/g, function (_, id) { return 'url(#' + prefix + id + ')' })
        if ((attribute.name === 'href' || attribute.name === 'xlink:href') && value.charAt(0) === '#') next = '#' + prefix + value.slice(1)
        if (next !== value) element.setAttribute(attribute.name, next)
      })
    })
  }
  // The members as they sit on the page, alone: the untouched original.
  function isolated(svg, members, viewBox) {
    var copy = svg.cloneNode(false)
    copy.setAttribute('viewBox', viewBox.x + ' ' + viewBox.y + ' ' + viewBox.width + ' ' + viewBox.height)
    copy.setAttribute('width', String(viewBox.width))
    copy.setAttribute('height', String(viewBox.height))
    var definitions = withDefinitions(svg, members)
    if (definitions.length) {
      var defs = document.createElementNS(NS, 'defs')
      definitions.forEach(function (definition) { defs.appendChild(definition.cloneNode(true)) })
      copy.appendChild(defs)
    }
    var wrappers = new Map()
    var wrapperFor = function (parent) {
      if (parent === svg) return copy
      if (wrappers.has(parent)) return wrappers.get(parent)
      var shell = parent.cloneNode(false)
      wrapperFor(parent.parentElement).appendChild(shell)
      wrappers.set(parent, shell)
      return shell
    }
    members.forEach(function (member) { wrapperFor(member.parentElement).appendChild(member.cloneNode(true)) })
    return copy
  }
  // The members as the page draws them: the whole page, its stylesheet and
  // context intact, with everything else hidden. What the lifted artwork is
  // checked against.
  var DEFINITIONS = ['defs', 'style', 'title', 'desc', 'symbol', 'marker', 'clippath', 'mask', 'lineargradient', 'radialgradient', 'pattern', 'filter']
  function inPlace(svg, members, viewBox) {
    members.forEach(function (member) { member.setAttribute('data-cast-member', '') })
    var copy = svg.cloneNode(true)
    members.forEach(function (member) { member.removeAttribute('data-cast-member') })
    copy.setAttribute('viewBox', viewBox.x + ' ' + viewBox.y + ' ' + viewBox.width + ' ' + viewBox.height)
    copy.setAttribute('width', String(viewBox.width))
    copy.setAttribute('height', String(viewBox.height))
    var hide = function (element) {
      Array.from(element.children).forEach(function (child) {
        if (child.hasAttribute('data-cast-member')) return
        if (DEFINITIONS.indexOf(child.tagName.toLowerCase()) >= 0) return
        if (child.querySelector('[data-cast-member]')) return hide(child)
        child.style.setProperty('display', 'none', 'important')
      })
    }
    hide(copy)
    return copy
  }
  // The members lifted out: carried styles, their definitions, ids
  // namespaced, the box moved to the origin, nothing executable.
  function standalone(svg, members, bounds, prefix) {
    var out = document.createElementNS(NS, 'svg')
    out.setAttribute('xmlns', NS)
    out.setAttribute('viewBox', '0 0 ' + bounds.width + ' ' + bounds.height)
    out.setAttribute('width', String(bounds.width))
    out.setAttribute('height', String(bounds.height))
    var definitions = withDefinitions(svg, members)
    if (definitions.length) {
      var defs = document.createElementNS(NS, 'defs')
      definitions.forEach(function (definition) { defs.appendChild(definition.cloneNode(true)) })
      out.appendChild(defs)
    }
    var frame = document.createElementNS(NS, 'g')
    frame.setAttribute('transform', 'translate(' + (-bounds.x) + ' ' + (-bounds.y) + ')')
    INHERITED.forEach(function (name) { if (name !== 'transform' && svg.hasAttribute(name)) frame.setAttribute(name, svg.getAttribute(name)) })
    out.appendChild(frame)
    var wrappers = new Map()
    var wrapperFor = function (parent) {
      if (parent === svg) return frame
      if (wrappers.has(parent)) return wrappers.get(parent)
      var shell = document.createElementNS(NS, 'g')
      INHERITED.forEach(function (name) { if (parent.hasAttribute(name)) shell.setAttribute(name, parent.getAttribute(name)) })
      wrapperFor(parent.parentElement).appendChild(shell)
      wrappers.set(parent, shell)
      return shell
    }
    members.forEach(function (member) { wrapperFor(member.parentElement).appendChild(member.cloneNode(true)) })
    strip(out)
    prefixIds(out, prefix)
    return out
  }
  function slug(value) { return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') }
  function partsOf(members, node, origin) {
    var parts = []
    var used = new Set()
    var counts = {}
    var nodeSlug = (node.id || '').replace(/^s\d+-node-/, '')
    var add = function (element, name, named) {
      if (used.has(element)) return
      used.add(element)
      // Every part is addressable in the lifted artwork: an id and its name.
      if (!element.id) element.id = (node.id || 'node') + '-' + name
      if (!element.hasAttribute('data-part')) element.setAttribute('data-part', name)
      var anims = []
      ;[element].concat(Array.from(element.querySelectorAll('[data-anim]'))).forEach(function (el) {
        var anim = el.getAttribute('data-anim')
        if (anim && anims.indexOf(anim) < 0) anims.push(anim)
      })
      var box = rectOf(element, origin)
      parts.push({
        name: name,
        named: named,
        element: element.tagName.toLowerCase(),
        localId: element.id,
        count: element.tagName.toLowerCase() === 'g' ? element.children.length : 1,
        bounds: { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) },
        animations: anims,
      })
    }
    members.forEach(function (member) {
      var candidates = [member].concat(Array.from(member.querySelectorAll('[data-part], [id], [data-anim]')))
      candidates.forEach(function (element) {
        if (used.has(element)) return
        if (element.hasAttribute('data-part')) return add(element, element.getAttribute('data-part'), 'declared')
        if (element.id) {
          var name = element.id.replace(/^s\d+-/, '').replace('node-' + nodeSlug + '-', '').replace(nodeSlug + '-', '')
          return add(element, slug(name) || element.id, 'derived')
        }
        if (element.hasAttribute('data-anim') && !Array.from(used).some(function (part) { return part.contains(element) })) {
          var anim = element.getAttribute('data-anim')
          counts[anim] = (counts[anim] || 0) + 1
          return add(element, anim + '-' + counts[anim], 'derived')
        }
      })
    })
    return parts
  }
  function textOf(element) { return (element.textContent || '').replace(/\s+/g, ' ').trim() }
  function kindOf(members, bounds, node) {
    var all = members.reduce(function (list, member) { return list.concat([member], Array.from(member.querySelectorAll('*'))) }, [])
    var tags = all.map(function (element) { return element.tagName.toLowerCase() })
    var shapes = tags.filter(function (tag) { return tag !== 'g' && tag !== 'text' && tag !== 'tspan' })
    var bars = shapes.filter(function (tag) { return tag === 'rect' || tag === 'line' }).length
    if (Math.max(bounds.width, bounds.height) <= 72) return { kind: 'icon', basis: 'size' }
    if (node.hasAttribute('data-object') || all.some(function (element) { return element.hasAttribute('data-part') })) return { kind: 'object', basis: 'markup' }
    if (bars >= 5 && bars / Math.max(1, shapes.length) > 0.8) return { kind: 'chart', basis: 'shape' }
    return { kind: 'object', basis: 'shape' }
  }

  var results = []
  var host = document.getElementById('host')
  for (var p = 0; p < input.pages.length; p++) {
    var pageInput = input.pages[p]
    host.innerHTML = pageInput.svg
    var svg = host.querySelector('svg')
    if (!svg) { results.push({ scene: pageInput.scene, error: 'the page is not an SVG' }); continue }
    var viewBox = svg.viewBox && svg.viewBox.baseVal && svg.viewBox.baseVal.width ? svg.viewBox.baseVal : { x: 0, y: 0, width: 1280, height: 720 }
    svg.setAttribute('width', String(viewBox.width))
    svg.setAttribute('height', String(viewBox.height))
    var origin = svg.getBoundingClientRect()
    var page = { scene: pageInput.scene, width: viewBox.width, height: viewBox.height, furniture: [], ingredients: [], labels: [], styled: Boolean(svg.querySelector('style')) }
    var serializer = new XMLSerializer()
    var full = await load(serializer.serializeToString(svg), viewBox.width, viewBox.height)
    page.png = png(full)

    FURNITURE.forEach(function (role) {
      svg.querySelectorAll('[data-role="' + role + '"]').forEach(function (element) { page.furniture.push({ id: element.id || null, role: role, text: textOf(element).slice(0, 120) }) })
    })
    svg.querySelectorAll('[data-role="connector"]').forEach(function (element) {
      page.furniture.push({ id: element.id || null, role: 'connector', from: element.getAttribute('data-from'), to: element.getAttribute('data-to'), verb: element.getAttribute('data-verb') })
    })
    svg.querySelectorAll('[data-actor]').forEach(function (element) { page.furniture.push({ id: element.id || null, role: 'actor', actor: element.getAttribute('data-actor') }) })

    var nodes = Array.from(svg.querySelectorAll('[data-role="node"]'))
    for (var n = 0; n < nodes.length; n++) {
      var node = nodes[n]
      var texts = Array.from(node.children).filter(function (child) { return child.tagName.toLowerCase() === 'text' }).map(textOf).filter(Boolean)
      var art = node.querySelector('[data-appearance-for]')
      var box = node.querySelector('[id$="-box"]')
      var members = art ? Array.from(art.children) : Array.from(node.children).filter(function (child) { var tag = child.tagName.toLowerCase(); return child !== box && tag !== 'text' })
      var grouping = art ? 'declared' : 'inferred'
      page.labels.push({ node: node.id, label: texts[0] || '', detail: texts.slice(1) })
      if (box) page.furniture.push({ id: box.id, role: 'card', node: node.id })
      if (!members.length) continue
      // Members that sit together are one ingredient; a group whose members
      // fall into separate clusters is split, and the split is our proposal.
      var boxes = members.map(function (member) { return rectOf(member, origin) })
      var cluster = members.map(function (_, index) { return index })
      var find = function (index) { while (cluster[index] !== index) index = cluster[index] = cluster[cluster[index]]; return index }
      for (var a = 0; a < members.length; a++) for (var b = a + 1; b < members.length; b++) if (near(boxes[a], boxes[b])) cluster[find(a)] = find(b)
      var groups = new Map()
      members.forEach(function (member, index) { var key = find(index); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(member) })
      var split = groups.size > 1
      var g = 0
      for (var entry of groups) {
        var list = entry[1]
        g++
        // Where the ingredient really paints, from the pixels, so strokes,
        // markers and transforms are inside its box.
        var alone = inPlace(svg, list, { x: viewBox.x, y: viewBox.y, width: viewBox.width, height: viewBox.height })
        var drawn = await load(serializer.serializeToString(alone), viewBox.width, viewBox.height)
        var extent = drawn ? painted(drawn) : { count: 0 }
        if (!extent.count) continue
        var pad = 2
        var bounds = {
          x: Math.max(viewBox.x, viewBox.x + extent.x - pad),
          y: Math.max(viewBox.y, viewBox.y + extent.y - pad),
          width: 0,
          height: 0,
        }
        bounds.width = Math.min(viewBox.x + viewBox.width, viewBox.x + extent.x + extent.width + pad) - bounds.x
        bounds.height = Math.min(viewBox.y + viewBox.height, viewBox.y + extent.y + extent.height + pad) - bounds.y
        var prefix = 'cast-' + slug(pageInput.scene).slice(0, 12) + '-' + n + '-' + g + '-'
        // The untouched original first; then the parts are named and the
        // artwork lifted with them.
        var original = isolated(svg, list, bounds)
        var originalText = serializer.serializeToString(original)
        // What kind of thing it is, from the page's own markup — before any
        // part is named.
        var kind = kindOf(list, bounds, node)
        var parts = partsOf(list, node, origin).map(function (part) { part.id = prefix + part.localId; return part })
        var lifted = standalone(svg, list, bounds, prefix)
        var liftedText = serializer.serializeToString(lifted)
        var liftedCanvas = await load(liftedText, bounds.width, bounds.height)
        var reference = await load(serializer.serializeToString(inPlace(svg, list, bounds)), bounds.width, bounds.height)
        var compared = difference(liftedCanvas, reference)
        page.ingredients.push({
          node: node.id,
          nodeKind: node.getAttribute('data-kind'),
          entity: node.getAttribute('data-entity'),
          object: node.getAttribute('data-object'),
          objectId: node.getAttribute('data-object-id'),
          label: texts[0] || '',
          detail: texts.slice(1),
          groups: art ? [art.id].filter(Boolean) : list.map(function (member) { return member.id }).filter(Boolean),
          grouping: split ? 'inferred' : grouping,
          split: split ? { index: g, of: groups.size } : null,
          kind: kind.kind,
          kindBasis: kind.basis,
          bounds: bounds,
          parts: parts,
          svg: liftedText,
          original: originalText,
          thumbnail: png(scaled(liftedCanvas, 256)),
          painted: extent.count,
          verification: { ratio: compared.ratio, differing: compared.differing },
          colors: Array.from(new Set((liftedText.match(/#[0-9a-fA-F]{6}\b/g) || []).map(function (value) { return value.toLowerCase() }))),
          fonts: Array.from(new Set((liftedText.match(/font-family="([^"]+)"/g) || []).map(function (value) { return value.replace(/^font-family="|"$/g, '') }))),
        })
      }
    }
    // The page's contact sheet: every ingredient, labelled.
    var cell = { width: 220, height: 190 }
    var columns = Math.min(4, Math.max(1, page.ingredients.length))
    var rows = Math.max(1, Math.ceil(page.ingredients.length / columns))
    var sheet = document.createElement('canvas')
    sheet.width = columns * cell.width
    sheet.height = rows * cell.height + 36
    var ctx = sheet.getContext('2d')
    ctx.fillStyle = input.ground || '#111111'
    ctx.fillRect(0, 0, sheet.width, sheet.height)
    ctx.fillStyle = input.ink || '#f4f4f5'
    ctx.font = '600 15px system-ui, sans-serif'
    ctx.fillText('Visual cast · ' + (pageInput.title || pageInput.scene), 12, 24)
    for (var i = 0; i < page.ingredients.length; i++) {
      var ingredient = page.ingredients[i]
      var x = (i % columns) * cell.width
      var y = 36 + Math.floor(i / columns) * cell.height
      var thumb = await new Promise(function (resolve) {
        var image = new Image()
        image.onload = function () { resolve(image) }
        image.onerror = function () { resolve(null) }
        image.src = 'data:image/png;base64,' + ingredient.thumbnail
      })
      if (thumb) {
        var factor = Math.min((cell.width - 20) / thumb.width, (cell.height - 58) / thumb.height, 1)
        ctx.drawImage(thumb, x + (cell.width - thumb.width * factor) / 2, y + 6, thumb.width * factor, thumb.height * factor)
      }
      ctx.fillStyle = input.ink || '#f4f4f5'
      ctx.font = '600 13px system-ui, sans-serif'
      ctx.fillText(String(i + 1) + '. ' + (ingredient.label || ingredient.node).slice(0, 26), x + 10, y + cell.height - 32)
      ctx.fillStyle = input.muted || '#a1a1aa'
      ctx.font = '12px system-ui, sans-serif'
      ctx.fillText(ingredient.kind + ' · ' + ingredient.parts.length + ' parts · ' + ingredient.grouping, x + 10, y + cell.height - 14)
    }
    page.contactSheet = png(sheet)
    results.push(page)
  }
  return results
})
`
