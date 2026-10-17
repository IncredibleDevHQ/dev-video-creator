import { expect, it } from 'vitest'
import { brandRoles, type ColourStat } from './brand-colour'
import { cleanFamily, fontRoles, openFamily } from './brand-fonts'
import { rankIcons, readableOn, sanitizeSvg, svgColours } from './site-logo'

const stat = (hex: string, use: Partial<ColourStat> = {}): ColourStat => ({
  hex,
  count: 0,
  bgCount: 0,
  interactiveBg: 0,
  areaBg: 0,
  textCount: 0,
  maxArea: 0,
  ...use
})

it('reads a site’s colours by what each does: ground, text, accent, a second hue', () => {
  // A light page: the white paints the big blocks, the near-black sets the
  // text, the brand purple fills buttons and links; a lime appears once.
  const roles = brandRoles(
    [
      stat('#FFFFFF', { areaBg: 6, maxArea: 2_000_000, bgCount: 20 }),
      stat('#0A2540', { textCount: 400, count: 400 }),
      stat('#533AFD', { interactiveBg: 4, bgCount: 4, textCount: 12 }),
      stat('#E4F222', { interactiveBg: 1, bgCount: 1 }),
      stat('#F79CE0', { textCount: 45 })
    ],
    ['#FFFFFF', '#0A2540', '#533AFD', '#E4F222']
  )
  expect(roles).toEqual({
    ground: '#FFFFFF',
    text: '#0A2540',
    accent: '#533AFD',
    second: '#E4F222'
  })
  // A dark page: the ground is dark and the text light.
  expect(
    brandRoles(
      [
        stat('#0F1011', { areaBg: 10, maxArea: 900_000, bgCount: 37 }),
        stat('#F7F8F8', { textCount: 300 }),
        stat('#5E6AD2', { interactiveBg: 1, bgCount: 1 })
      ],
      ['#F7F8F8', '#0F1011', '#5E6AD2']
    )
  ).toMatchObject({ ground: '#0F1011', text: '#F7F8F8', accent: '#5E6AD2' })
})

it('takes the colour on a real control over a status colour in a product shot', () => {
  const roles = brandRoles(
    [
      stat('#0F1011', { areaBg: 10, bgCount: 30 }),
      stat('#F7F8F8', { textCount: 300 }),
      // A red status chip: background and text, more prominent.
      stat('#F34E52', { bgCount: 7, textCount: 3, count: 10 }),
      // The indigo button: background on a control.
      stat('#5E6AD2', { bgCount: 1, interactiveBg: 1, count: 1 })
    ],
    ['#F7F8F8', '#0F1011', '#F34E52', '#5E6AD2']
  )
  expect(roles?.accent).toBe('#5E6AD2')
})

it('finds a brand colour that runs through the page as a family of tints', () => {
  // Vercel's blue shows in the palette with its tints, while a green is set
  // in three spots of text and nowhere else.
  const roles = brandRoles(
    [
      stat('#FAFAFA', { areaBg: 5, maxArea: 10_000_000, bgCount: 9 }),
      stat('#171717', { textCount: 400, bgCount: 8 }),
      stat('#297A3A', { textCount: 3, count: 3 })
    ],
    [
      '#EBEBEB',
      '#171717',
      '#FAFAFA',
      '#4D4D4D',
      '#FFFFFF',
      '#0072F5',
      '#CCE6FF',
      '#99CEFF',
      '#52AEFF',
      '#0062D1'
    ]
  )
  expect(roles?.accent).toBe('#0072F5')
  // A different hue as the second, never a shade of the accent.
  expect(roles?.second).toBe('#297A3A')
})

it('names no accent for a page with no colour of its own, and never a browser’s link blue', () => {
  const roles = brandRoles(
    [
      stat('#FFFFFF', { areaBg: 3, bgCount: 3 }),
      stat('#111111', { textCount: 200 }),
      stat('#0000EE', { textCount: 40 })
    ],
    ['#FFFFFF', '#111111', '#0000EE']
  )
  expect(roles).toEqual({ ground: '#FFFFFF', text: '#111111' })
  expect(brandRoles([], [])).toBeNull()
})

it('knows a face by its foundry name, and which faces may travel', () => {
  expect(cleanFamily('Inter-1b28280e86394dd4')).toBe('Inter')
  expect(
    cleanFamily('"Inter-1b28280e86394dd4 fallback: Arial", sans-serif')
  ).toBe('Inter')
  expect(cleanFamily('__Plus_Jakarta_Sans_3a2f9e')).toBe('Plus Jakarta Sans')
  expect(cleanFamily('__Inter_Fallback_d65c78')).toBe('Inter')
  expect(openFamily('Inter Variable')).toBe('Inter')
  expect(openFamily('InterVariable')).toBe('Inter')
  expect(openFamily('Inter Tight-a9918f95fa071050')).toBe('Inter Tight')
  expect(openFamily('GeistSans')).toBe('Geist')
  expect(openFamily('plexMono')).toBe('IBM Plex Mono')
  // A commercial face never travels as a file.
  expect(openFamily('sohne-var')).toBeNull()
  expect(openFamily('Berkeley Mono')).toBeNull()
})

it('picks the headings, text and code faces from what the page paints', () => {
  const roles = fontRoles({
    ranked: [
      { family: 'Inter-1b28280e86394dd4', weight: 9000 },
      { family: 'JetBrains Mono-7714ae63c2907103', weight: 4000 },
      { family: 'Inter Tight-a9918f95fa071050', weight: 1200 }
    ],
    heading: 'Inter Tight-a9918f95fa071050',
    // The first paragraph sits in a code sample: not the text face.
    body: 'JetBrains Mono-7714ae63c2907103',
    // Inline code set in the text face is not the code face.
    mono: 'Inter-1b28280e86394dd4',
    variables: { '--font-display': '"Inter Tight-a9918f95fa071050"' }
  })
  expect(roles).toMatchObject({
    display: 'Inter Tight',
    body: 'Inter',
    mono: 'JetBrains Mono'
  })
  // A page that names nothing of its own uses the system's faces.
  expect(
    fontRoles({
      ranked: [],
      heading: 'system-ui',
      body: '',
      mono: '',
      variables: {}
    })
  ).toMatchObject({ display: 'system-ui', mono: 'ui-monospace' })
})

it('keeps a site’s SVG to safe drawing, with its paint', () => {
  const svg = sanitizeSvg(
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 60 25" width="60" height="25" onload="steal()"><script>alert(1)</script><style>path{fill:red}</style><defs><linearGradient id="g"><stop offset="0" stop-color="#533afd"/></linearGradient></defs><path d="M0 0h10v10z" fill="url(#g)" onclick="x()" style="behavior:url(x.htc)"/><use xlink:href="#g"/><use href="https://evil.example/x.svg#a"/><foreignObject><div>hi</div></foreignObject><text font-family="Inter" fill="rgb(83, 58, 253)" x="1" y="2">Stripe</text></svg>`
  )!
  expect(svg).toContain('viewBox="0 0 60 25"')
  expect(svg).toContain('fill="url(#g)"')
  expect(svg).toContain('xlink:href="#g"')
  expect(svg).toContain('<text font-family="Inter"')
  for (const unsafe of [
    '<script',
    '<style',
    'onload',
    'onclick',
    'behavior',
    'foreignObject',
    'evil.example'
  ])
    expect(svg).not.toContain(unsafe)
  expect(svgColours(svg)).toEqual(['#533AFD'])
  expect(sanitizeSvg('<svg><script>alert(1)</script></svg>')).toBeNull()
  expect(sanitizeSvg('<div>no drawing</div>')).toBeNull()
})

it('paints a one-colour logo that would vanish on the ground in the text colour', () => {
  const black =
    '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0" fill="rgb(0, 0, 0)"/></svg>'
  expect(readableOn(black, '#0F1011', '#F7F8F8')).toContain('fill="#F7F8F8"')
  // It reads already, or it has its own colours: left as drawn.
  expect(readableOn(black, '#FFFFFF', '#111111')).toBe(black)
  const two =
    '<svg xmlns="http://www.w3.org/2000/svg"><path fill="#000000"/><path fill="#FF5E1F"/></svg>'
  expect(readableOn(two, '#0F1011', '#F7F8F8')).toBe(two)
})

it('ranks a page’s icons as a browser would pick them', () => {
  const ranked = rankIcons([
    { rel: 'icon', href: 'https://a.example/favicon.ico' },
    { rel: 'mask-icon', href: 'https://a.example/mask.svg' },
    { rel: 'icon', href: 'https://a.example/icon-32.png', sizes: '32x32' },
    { rel: 'apple-touch-icon', href: 'https://a.example/touch.png' },
    { rel: 'icon', href: 'https://a.example/icon.svg', type: 'image/svg+xml' }
  ]).map((icon) => icon.href.split('/').pop())
  expect(ranked).toEqual([
    'icon.svg',
    'touch.png',
    'icon-32.png',
    'favicon.ico',
    'mask.svg'
  ])
})
