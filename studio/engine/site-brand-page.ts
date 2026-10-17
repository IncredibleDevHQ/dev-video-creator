// What the site-brand read collects inside the rendered page, in one pass:
// every colour with how it is used, the colours in order of prominence, the
// faces the page sets text in and declares, its logo candidates and icons.
// It runs as a string: tsx keeps function names with a __name helper the
// page doesn't have, and a function passed to evaluate fails with it.
export const BRAND_PAGE_SCRIPT = String.raw`(() => {
  var hexOf = function (value) {
    if (!value || value === 'transparent' || value === 'none' || value === 'currentcolor') return null;
    var m = /rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?/i.exec(value);
    if (!m) {
      var s = /color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?/i.exec(value);
      if (s) m = [null, String(parseFloat(s[1]) * 255), String(parseFloat(s[2]) * 255), String(parseFloat(s[3]) * 255), s[4]];
    }
    if (!m && /oklch|oklab|lch|lab|hsl|color-mix|color\(/i.test(value)) {
      try {
        var canvas = document.createElement('canvas');
        canvas.width = 1; canvas.height = 1;
        var context = canvas.getContext('2d');
        context.fillStyle = value; context.fillRect(0, 0, 1, 1);
        var px = context.getImageData(0, 0, 1, 1).data;
        if (px[3] < 13) return null;
        m = [null, String(px[0]), String(px[1]), String(px[2])];
      } catch (e) { return null; }
    }
    if (!m) return null;
    if (m[4] !== undefined && m[4] !== null) {
      var alpha = /%$/.test(m[4]) ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
      if (alpha < 0.05) return null;
    }
    return '#' + [m[1], m[2], m[3]].map(function (n) {
      return Math.max(0, Math.min(255, Math.round(parseFloat(n)))).toString(16).padStart(2, '0');
    }).join('').toUpperCase();
  };
  var shown = function (el) {
    var style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    var rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };

  // The colours in order of prominence: what the eye meets most.
  var palette = {};
  var add = function (value, weight) {
    var hex = hexOf(value);
    if (hex) palette[hex] = (palette[hex] || 0) + (weight || 1);
  };
  add(getComputedStyle(document.documentElement).backgroundColor, 10);
  add(getComputedStyle(document.body).backgroundColor, 10);
  for (var gy = 0; gy < 5; gy++) for (var gx = 0; gx < 6; gx++) {
    var at = document.elementFromPoint(Math.round((gx + 0.5) * innerWidth / 6), Math.round((gy + 0.5) * innerHeight / 5));
    if (!at) continue;
    add(getComputedStyle(at).color, 2);
    var walker = at, ground = null;
    while (walker && !ground) { ground = hexOf(getComputedStyle(walker).backgroundColor); walker = walker.parentElement; }
    if (ground) palette[ground] = (palette[ground] || 0) + 3;
  }
  var notable = Array.from(document.querySelectorAll('body, header, nav, main, footer, section, h1, h2, h3, a, button, [role="button"], [class*="hero"], [class*="cta"], [class*="btn"], [class*="card"], [class*="badge"], [class*="accent"], [class*="highlight"]')).slice(0, 200);
  notable.forEach(function (el) {
    var style = getComputedStyle(el);
    add(style.backgroundColor); add(style.color); add(style.borderTopColor);
    var gradient = style.backgroundImage;
    if (gradient && gradient !== 'none') (gradient.match(/#[0-9a-f]{3,8}|rgba?\([^)]+\)|oklch\([^)]+\)|hsla?\([^)]+\)/gi) || []).forEach(function (c) { add(c); });
  });

  // Coloured blocks early in the page (code, banners, cards) the grid can miss.
  var swept = 0;
  Array.from(document.querySelectorAll('*')).some(function (el) {
    var hex = hexOf(getComputedStyle(el).backgroundColor);
    if (hex && hex !== '#FFFFFF' && hex !== '#000000') palette[hex] = (palette[hex] || 0) + 1;
    return ++swept >= 500;
  });

  // How each colour is used: as a fill, on a control, over a large block, as text.
  var stats = {};
  var stat = function (hex) {
    return stats[hex] || (stats[hex] = { hex: hex, count: 0, bgCount: 0, interactiveBg: 0, areaBg: 0, textCount: 0, maxArea: 0 });
  };
  var everything = Array.from(document.querySelectorAll('*')).slice(0, 9000);
  everything.forEach(function (el) {
    var style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return;
    var rect = el.getBoundingClientRect();
    var area = rect.width * rect.height;
    var tag = el.tagName.toLowerCase();
    var role = el.getAttribute('role') || '';
    var cls = typeof el.className === 'string' ? el.className : '';
    var control = tag === 'a' || tag === 'button' || role === 'button' || role === 'link' || role === 'tab' || role === 'menuitem' || /\b(btn|button|cta|primary|action)\b/i.test(cls);
    var bg = hexOf(style.backgroundColor);
    if (bg) {
      var s = stat(bg);
      s.count++; s.bgCount++;
      if (control) s.interactiveBg++;
      if (area > 50000) s.areaBg++;
      if (area > s.maxArea) s.maxArea = Math.round(area);
    }
    // Code is coloured by its syntax, not by the brand.
    var ink = el.closest('pre, code, kbd, samp, [class*="language-"], .hljs, .shiki, .highlight') ? null : hexOf(style.color);
    if (ink) { var t = stat(ink); t.count++; t.textCount++; }
  });
  // Every rule of a sheet, inside @layer, @media and @supports blocks too.
  var eachRule = function (list, visit, depth) {
    for (var n = 0; n < list.length; n++) {
      visit(list[n]);
      if (list[n].cssRules && (depth || 0) < 4) eachRule(list[n].cssRules, visit, (depth || 0) + 1);
    }
  };
  var root = getComputedStyle(document.documentElement);
  var variables = {};
  for (var i = 0; i < document.styleSheets.length; i++) {
    try {
      eachRule(document.styleSheets[i].cssRules, function (rule) {
        if (!rule.style || !/(^|,)\s*(:root|html)\s*(,|$)/.test(rule.selectorText || '')) return;
        for (var k = 0; k < rule.style.length; k++) {
          var name = rule.style[k];
          if (name.indexOf('--') !== 0) continue;
          var value = root.getPropertyValue(name).trim();
          if (/font/i.test(name)) variables[name] = value;
          else if (/^(#|rgb|hsl|oklch|oklab|lch|lab|color\()/i.test(value)) add(value);
        }
      });
    } catch (e) {}
  }

  // The faces the page sets its text in, and the faces it declares.
  var families = {};
  var familyOf = function (el) { return getComputedStyle(el).fontFamily.split(',')[0].replace(/["']/g, '').trim(); };
  everything.slice(0, 5000).forEach(function (el) {
    var text = 0;
    for (var n = 0; n < el.childNodes.length; n++) if (el.childNodes[n].nodeType === 3) text += (el.childNodes[n].textContent || '').trim().length;
    if (!text || !shown(el)) return;
    var style = getComputedStyle(el);
    var family = familyOf(el);
    if (family) families[family] = (families[family] || 0) + text * (parseFloat(style.fontSize) || 16);
  });
  var first = function (selector, minText) {
    var list = document.querySelectorAll(selector);
    for (var n = 0; n < list.length && n < 60; n++)
      if (shown(list[n]) && (list[n].textContent || '').trim().length >= (minText || 1)) return familyOf(list[n]);
    return '';
  };
  var faces = [], blocked = [];
  var sourcesOf = function (src, base) {
    var urls = [];
    (src || '').replace(/url\(\s*(?:"([^"]+)"|'([^']+)'|([^)\s]+))\s*\)\s*(?:format\(\s*["']?([^"')]+)["']?\s*\))?/gi, function (whole, a, b, c, format) {
      try { urls.push({ url: new URL(a || b || c, base).href, format: format || '' }); } catch (e) {}
      return whole;
    });
    return urls;
  };
  for (var si = 0; si < document.styleSheets.length; si++) {
    var sheet = document.styleSheets[si];
    var base = sheet.href || location.href;
    try {
      eachRule(sheet.cssRules, function (rule) {
        if (rule.type !== 5) return;
        faces.push({
          family: (rule.style.getPropertyValue('font-family') || '').replace(/["']/g, '').trim(),
          weight: rule.style.getPropertyValue('font-weight') || '400',
          style: rule.style.getPropertyValue('font-style') || 'normal',
          sources: sourcesOf(rule.style.getPropertyValue('src'), base),
          range: rule.style.getPropertyValue('unicode-range') || ''
        });
      });
    } catch (e) { if (sheet.href) blocked.push(sheet.href); }
  }
  var loaded = [];
  try { document.fonts.forEach(function (face) { if (face.status === 'loaded') loaded.push({ family: face.family.replace(/["']/g, ''), weight: face.weight, style: face.style }); }); } catch (e) {}

  // The site's own logo: the mark its header or home link shows, named for
  // the brand, never a customer's in a logo wall.
  var brandWords = [];
  var siteName = (document.querySelector('meta[property="og:site_name"]') || {}).content || '';
  [siteName, (document.title || '').split(/\s[|\-–—:·]\s/)[0], location.hostname.replace(/^www\./, '').split('.')[0]].forEach(function (word) {
    word = (word || '').trim().toLowerCase();
    if (word.length > 1 && word.length < 40 && brandWords.indexOf(word) === -1) brandWords.push(word);
  });
  // A link to the site's own home: this host's root, or the root of the
  // site it belongs to (a blog's logo goes to the company's home page).
  var site = location.hostname.split('.').slice(-2).join('.');
  var homeLink = function (el) {
    var link = el.closest('a[href]');
    if (!link) return false;
    try {
      var url = new URL(link.getAttribute('href'), location.href);
      var same = url.hostname === location.hostname || url.hostname === site || url.hostname.slice(-site.length - 1) === '.' + site;
      return same && /^\/([a-z]{2}(-[a-z]{2})?\/?)?$/i.test(url.pathname);
    } catch (e) { return false; }
  };
  var named = function (el) {
    var words = [el.getAttribute('aria-label'), el.getAttribute('alt'), el.getAttribute('title'), el.querySelector && el.querySelector('title') ? el.querySelector('title').textContent : '', el.closest('a[href]') ? el.closest('a[href]').getAttribute('aria-label') : ''];
    return words.filter(Boolean).join(' ').toLowerCase();
  };
  var hinted = function (el) {
    for (var up = el, depth = 0; up && depth < 4; up = up.parentElement, depth++) {
      var hint = (typeof up.className === 'string' ? up.className : (up.getAttribute && up.getAttribute('class')) || '') + ' ' + (up.id || '');
      if (/logo|brand|wordmark|lockup/i.test(hint)) return true;
    }
    return false;
  };
  var crowd = function (el) {
    return Boolean(el.closest('[class*="customer" i], [class*="partner" i], [class*="marquee" i], [class*="logos" i], [class*="client" i], [class*="trusted" i], [class*="testimonial" i], [class*="sponsor" i]'));
  };
  var banners = Array.from(document.querySelectorAll('header, nav, [role="banner"]'));
  var firstInBanner = banners.map(function (banner) { return banner.querySelector('svg, img'); }).filter(Boolean);
  var candidates = Array.from(document.querySelectorAll('svg, img')).slice(0, 500).map(function (el) {
    if (el.tagName.toLowerCase() === 'svg' && el.parentElement && el.parentElement.closest('svg')) return null;
    if (!shown(el)) return null;
    var rect = el.getBoundingClientRect();
    var top = rect.top + scrollY;
    if (rect.width < 16 || rect.height < 10 || rect.width / rect.height > 14) return null;
    var label = named(el);
    var score = 0;
    if (homeLink(el)) score += 4;
    if (el.closest('header, nav, [role="banner"]')) score += 3;
    if (brandWords.some(function (word) { return label.indexOf(word) !== -1; })) score += 3;
    if (/logo/.test(label) || hinted(el)) score += 2;
    if (firstInBanner.indexOf(el) !== -1) score += 2;
    if (top < 160) score += 1;
    if (rect.width >= 48) score += 1;
    if (crowd(el)) score -= 6;
    if (el.closest('footer')) score -= 1;
    if (/menu|search|close|chevron|arrow|caret|hamburger|toggle|github|twitter|linkedin|youtube|discord/.test(label + ' ' + (typeof el.className === 'string' ? el.className : (el.getAttribute('class') || '')))) score -= 4;
    if (rect.width > 600 || rect.height > 220) score -= 3;
    if (rect.width < 24 && rect.height < 24) score -= 3;
    return { el: el, score: score, label: label.slice(0, 80), width: Math.round(rect.width), height: Math.round(rect.height), top: Math.round(top) };
  }).filter(function (c) { return c && c.score >= 3; }).sort(function (a, b) { return b.score - a.score || a.top - b.top; }).slice(0, 4);

  var PAINTED = /^(path|rect|circle|ellipse|line|polyline|polygon|text|tspan|use)$/;
  // A computed paint as the drawing needs it: a reference resolved to the
  // page's address goes back to its fragment, a colour in any space to hex.
  var paint = function (value) {
    if (!value || value === 'none') return value;
    var ref = /url\(\s*["']?[^"')#]*#([^"')]+)["']?\s*\)/.exec(value);
    if (ref) return 'url(#' + ref[1] + ')';
    return hexOf(value) || value;
  };
  var paintClone = function (svg) {
    var clone = svg.cloneNode(true);
    var from = [svg].concat(Array.from(svg.querySelectorAll('*')));
    var to = [clone].concat(Array.from(clone.querySelectorAll('*')));
    from.forEach(function (el, n) {
      var target = to[n];
      if (!target) return;
      var style = getComputedStyle(el);
      var tag = el.tagName.toLowerCase();
      if (style.display === 'none') target.setAttribute('display', 'none');
      if (PAINTED.test(tag)) {
        target.setAttribute('fill', paint(style.fill));
        target.setAttribute('stroke', paint(style.stroke));
        if (style.strokeWidth) target.setAttribute('stroke-width', style.strokeWidth);
        if (style.fillOpacity !== '1') target.setAttribute('fill-opacity', style.fillOpacity);
        if (style.strokeOpacity !== '1') target.setAttribute('stroke-opacity', style.strokeOpacity);
        if (style.fillRule) target.setAttribute('fill-rule', style.fillRule);
      }
      if (style.opacity !== '1') target.setAttribute('opacity', style.opacity);
      if (tag === 'text' || tag === 'tspan') {
        target.setAttribute('font-family', style.fontFamily);
        target.setAttribute('font-size', style.fontSize);
        target.setAttribute('font-weight', style.fontWeight);
      }
      if (tag === 'stop') target.setAttribute('stop-color', paint(style.stopColor));
      target.removeAttribute('class');
      target.removeAttribute('style');
    });
    var defs = null;
    var bring = function (id) {
      if (!id || clone.querySelector('[id="' + id + '"]')) return;
      var source = document.getElementById(id);
      if (!source) return;
      if (!defs) { defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs'); clone.insertBefore(defs, clone.firstChild); }
      defs.appendChild(source.tagName.toLowerCase() === 'svg' || source.tagName.toLowerCase() === 'symbol' ? paintClone(source) : source.cloneNode(true));
    };
    Array.from(clone.querySelectorAll('use')).forEach(function (use) {
      var ref = use.getAttribute('href') || use.getAttribute('xlink:href') || '';
      if (ref.charAt(0) === '#') bring(ref.slice(1));
    });
    to.forEach(function (el) {
      ['fill', 'stroke', 'clip-path', 'mask'].forEach(function (name) {
        var ref = /url\(\s*["']?#([^"')]+)/.exec(el.getAttribute(name) || '');
        if (ref) bring(ref[1]);
      });
    });
    var rect = svg.getBoundingClientRect();
    if (!clone.getAttribute('viewBox')) clone.setAttribute('viewBox', '0 0 ' + Math.round(rect.width) + ' ' + Math.round(rect.height));
    clone.setAttribute('width', String(Math.round(rect.width)));
    clone.setAttribute('height', String(Math.round(rect.height)));
    return clone;
  };
  var logos = candidates.map(function (c, n) {
    c.el.setAttribute('data-brand-logo', String(n));
    var svg = c.el.tagName.toLowerCase() === 'svg';
    var out = { index: n, kind: svg ? 'svg' : 'img', score: c.score, label: c.label, width: c.width, height: c.height, top: c.top };
    if (svg) {
      try { out.markup = new XMLSerializer().serializeToString(paintClone(c.el)); } catch (e) {}
    } else out.src = c.el.currentSrc || c.el.src || '';
    return out;
  });
  var icons = Array.from(document.querySelectorAll('link[rel]')).filter(function (link) {
    return /icon/i.test(link.getAttribute('rel') || '');
  }).map(function (link) {
    return { rel: link.getAttribute('rel') || '', href: link.href, sizes: link.getAttribute('sizes'), type: link.getAttribute('type') };
  });

  var top = function (object, limit) {
    return Object.keys(object).map(function (key) { return { family: key, weight: object[key] }; }).sort(function (a, b) { return b.weight - a.weight; }).slice(0, limit);
  };
  var meta = function (name) {
    var el = document.querySelector('meta[property="' + name + '"]') || document.querySelector('meta[name="' + name + '"]');
    return el ? el.getAttribute('content') || '' : '';
  };
  return {
    meta: { title: document.title || '', siteName: siteName, description: meta('description') || meta('og:description'), themeColor: meta('theme-color') },
    palette: Object.keys(palette).sort(function (a, b) { return palette[b] - palette[a]; }).slice(0, 24),
    stats: Object.keys(stats).map(function (key) { return stats[key]; }).filter(function (s) { return s.bgCount > 0 || s.count >= 3; }).sort(function (a, b) { return (b.bgCount + b.interactiveBg * 3 + b.textCount) - (a.bgCount + a.interactiveBg * 3 + a.textCount); }).slice(0, 48),
    fonts: { ranked: top(families, 12), heading: first('h1') || first('h2'), body: first('p', 40) || familyOf(document.body), mono: first('code, pre, kbd, samp'), variables: variables, faces: faces.slice(0, 80), blocked: blocked.slice(0, 8), loaded: loaded.slice(0, 60) },
    logos: logos,
    icons: icons
  };
})()`
