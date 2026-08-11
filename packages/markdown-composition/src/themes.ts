import type {
  BrandTemplateV1,
  StudioThemeV1,
  ThemeCanvasTreatment,
} from './types'

const createTheme = (
  theme: Omit<StudioThemeV1, 'version'>,
): StudioThemeV1 => ({ version: 1, ...theme })

export const defaultBrand: BrandTemplateV1 = {
  background: '#111827',
  surface: '#1f2024',
  text: '#f9fafb',
  mutedText: '#a1a1aa',
  primary: '#16a34a',
  secondary: '#15803d',
  accent: '#4ade80',
  codeBackground: '#0f172a',
}

export const defaultStudioTheme = createTheme({
  id: 'incredible-dark',
  name: 'Incredible Dark',
  description: 'The original human-first Studio direction.',
  source: 'built-in',
  brand: { ...defaultBrand },
  logo: { url: '', placement: 'footer-left', size: 28 },
  canvas: {
    treatment: 'gradient',
    gradient: ['#111827', '#17251d'],
    gridColor: '#4ade8030',
  },
  video: {
    layout: 'information-circle',
    borderStyle: 'solid',
    borderWidth: 10,
    borderRadius: 44,
  },
  blocks: {
    title: 'statement',
    list: 'bullets',
    code: 'panel',
    quote: 'bar',
    surface: 'outline',
    borderRadius: 34,
  },
})

export const builtinStudioThemes: StudioThemeV1[] = [
  defaultStudioTheme,
  createTheme({
    id: 'lee-gradient-grid',
    name: 'Gradient Grid',
    description: 'Lee-inspired black canvas, vivid edges and editorial layouts.',
    source: 'built-in',
    brand: {
      background: '#070709',
      surface: '#15151a',
      text: '#ffffff',
      mutedText: '#a1a1aa',
      primary: '#e03cff',
      secondary: '#6d5cff',
      accent: '#6d5cff',
      codeBackground: '#111c31',
    },
    logo: { url: '', placement: 'footer-left', size: 28 },
    canvas: {
      treatment: 'grid',
      gradient: ['#ff3ca6', '#4c5cff'],
      gridColor: '#ffffff20',
    },
    video: {
      layout: 'portrait-overlay',
      borderStyle: 'gradient',
      borderWidth: 9,
      borderRadius: 16,
    },
    blocks: {
      title: 'split',
      list: 'cards',
      code: 'terminal',
      quote: 'statement',
      surface: 'none',
      borderRadius: 16,
    },
  }),
  createTheme({
    id: 'midnight-signal',
    name: 'Midnight Signal',
    description: 'Deep navy with electric cyan for crisp technical stories.',
    source: 'built-in',
    brand: {
      background: '#07111f',
      surface: '#10243a',
      text: '#f1f8ff',
      mutedText: '#91a7bd',
      primary: '#22d3ee',
      secondary: '#2563eb',
      accent: '#60a5fa',
      codeBackground: '#040b14',
    },
    logo: { url: '', placement: 'top-left', size: 30 },
    canvas: {
      treatment: 'gradient',
      gradient: ['#07111f', '#102f46'],
      gridColor: '#22d3ee24',
    },
    video: {
      layout: 'split',
      borderStyle: 'solid',
      borderWidth: 6,
      borderRadius: 28,
    },
    blocks: {
      title: 'split',
      list: 'timeline',
      code: 'full',
      quote: 'bar',
      surface: 'outline',
      borderRadius: 24,
    },
  }),
  createTheme({
    id: 'warm-editorial',
    name: 'Warm Editorial',
    description: 'Paper, ink and coral for calm, personal explanations.',
    source: 'built-in',
    brand: {
      background: '#f5efe5',
      surface: '#fffaf2',
      text: '#211e1a',
      mutedText: '#756d63',
      primary: '#e45838',
      secondary: '#b82f52',
      accent: '#b82f52',
      codeBackground: '#25211d',
    },
    logo: { url: '', placement: 'footer-left', size: 28 },
    canvas: {
      treatment: 'solid',
      gradient: ['#f5efe5', '#f4c7b8'],
      gridColor: '#211e1a14',
    },
    video: {
      layout: 'information-tile',
      borderStyle: 'solid',
      borderWidth: 8,
      borderRadius: 4,
    },
    blocks: {
      title: 'lower-third',
      list: 'steps',
      code: 'panel',
      quote: 'card',
      surface: 'card',
      borderRadius: 4,
    },
  }),
  createTheme({
    id: 'lilac-motion',
    name: 'Lilac Motion',
    description: 'Soft violet gradients with friendly rounded surfaces.',
    source: 'built-in',
    brand: {
      background: '#271d3b',
      surface: '#3a2854',
      text: '#fffaff',
      mutedText: '#cab8df',
      primary: '#c084fc',
      secondary: '#8b5cf6',
      accent: '#f0abfc',
      codeBackground: '#1b1429',
    },
    logo: { url: '', placement: 'top-right', size: 30 },
    canvas: {
      treatment: 'gradient',
      gradient: ['#271d3b', '#7540a8'],
      gridColor: '#f0abfc24',
    },
    video: {
      layout: 'portrait-rail',
      borderStyle: 'gradient',
      borderWidth: 8,
      borderRadius: 52,
    },
    blocks: {
      title: 'statement',
      list: 'cards',
      code: 'panel',
      quote: 'card',
      surface: 'card',
      borderRadius: 38,
    },
  }),
  createTheme({
    id: 'high-contrast',
    name: 'High Contrast',
    description: 'Direct black, white and yellow for bold short-form lessons.',
    source: 'built-in',
    brand: {
      background: '#050505',
      surface: '#171717',
      text: '#ffffff',
      mutedText: '#b3b3b3',
      primary: '#facc15',
      secondary: '#fb7185',
      accent: '#fb7185',
      codeBackground: '#0b0b0b',
    },
    logo: { url: '', placement: 'footer-right', size: 28 },
    canvas: {
      treatment: 'solid',
      gradient: ['#050505', '#3d2e00'],
      gridColor: '#ffffff18',
    },
    video: {
      layout: 'person-background-left',
      borderStyle: 'none',
      borderWidth: 0,
      borderRadius: 0,
    },
    blocks: {
      title: 'lower-third',
      list: 'bullets',
      code: 'terminal',
      quote: 'statement',
      surface: 'none',
      borderRadius: 0,
    },
  }),
]

const normalizeHex = (value: string) => {
  const compact = value.trim().replace(/^#/, '')
  if (/^[0-9a-f]{3}$/i.test(compact)) {
    return `#${compact
      .split('')
      .map(character => `${character}${character}`)
      .join('')}`.toLowerCase()
  }
  return /^[0-9a-f]{6}$/i.test(compact)
    ? `#${compact.toLowerCase()}`
    : '#16a34a'
}

const hexToHsl = (value: string) => {
  const hex = normalizeHex(value).slice(1)
  const [red, green, blue] = [0, 2, 4].map(offset =>
    Number.parseInt(hex.slice(offset, offset + 2), 16) / 255,
  )
  const maximum = Math.max(red, green, blue)
  const minimum = Math.min(red, green, blue)
  const delta = maximum - minimum
  const lightness = (maximum + minimum) / 2
  let hue = 0
  if (delta) {
    if (maximum === red) hue = ((green - blue) / delta) % 6
    else if (maximum === green) hue = (blue - red) / delta + 2
    else hue = (red - green) / delta + 4
    hue = Math.round(hue * 60)
    if (hue < 0) hue += 360
  }
  const saturation = delta
    ? delta / (1 - Math.abs(2 * lightness - 1))
    : 0
  return { hue, saturation: saturation * 100, lightness: lightness * 100 }
}

const hsl = (hue: number, saturation: number, lightness: number) => {
  const normalizedHue = ((hue % 360) + 360) % 360
  const normalizedSaturation = Math.min(100, Math.max(0, saturation)) / 100
  const normalizedLightness = Math.min(100, Math.max(0, lightness)) / 100
  const chroma =
    (1 - Math.abs(2 * normalizedLightness - 1)) * normalizedSaturation
  const segment = normalizedHue / 60
  const x = chroma * (1 - Math.abs((segment % 2) - 1))
  const [red, green, blue] =
    segment < 1
      ? [chroma, x, 0]
      : segment < 2
        ? [x, chroma, 0]
        : segment < 3
          ? [0, chroma, x]
          : segment < 4
            ? [0, x, chroma]
            : segment < 5
              ? [x, 0, chroma]
              : [chroma, 0, x]
  const match = normalizedLightness - chroma / 2
  return `#${[red, green, blue]
    .map(channel => Math.round((channel + match) * 255).toString(16).padStart(2, '0'))
    .join('')}`
}

export const generateThemeDirections = (
  brandColor: string,
  name = 'My brand',
  treatment: ThemeCanvasTreatment | 'both' = 'both',
  palette?: { secondary?: string; accent?: string },
): StudioThemeV1[] => {
  const base = normalizeHex(brandColor)
  const suppliedSecondary = palette?.secondary
    ? normalizeHex(palette.secondary)
    : null
  const suppliedAccent = palette?.accent ? normalizeHex(palette.accent) : null
  const color = hexToHsl(base)
  const treatments: ThemeCanvasTreatment[] =
    treatment === 'both' ? ['solid', 'gradient', 'grid'] : [treatment]
  const recipes = [
    { label: 'Night', background: hsl(color.hue, 30, 7), text: '#ffffff', shift: 52 },
    { label: 'Vivid', background: hsl(color.hue + 18, 38, 13), text: '#ffffff', shift: 78 },
    { label: 'Paper', background: hsl(color.hue, 26, 95), text: hsl(color.hue, 24, 11), shift: 42 },
    { label: 'Mono', background: '#101012', text: '#ffffff', shift: 180 },
  ]

  return recipes.map((recipe, index) => {
    const canvasTreatment = treatments[index % treatments.length]
    const light = index === 2
    const accent =
      suppliedAccent || hsl(color.hue + recipe.shift, 82, light ? 42 : 66)
    return createTheme({
      id: `generated-${Date.now()}-${index}`,
      name: `${name} ${recipe.label}`,
      description: `${canvasTreatment} direction generated from ${base}.`,
      source: 'generated',
      brand: {
        background: recipe.background,
        surface: hsl(color.hue, light ? 22 : 30, light ? 99 : 15),
        text: recipe.text,
        mutedText: hsl(color.hue, 12, light ? 42 : 72),
        primary: base,
        secondary:
          suppliedSecondary ||
          hsl(color.hue + recipe.shift / 2, 76, light ? 38 : 58),
        accent,
        codeBackground: light ? '#1c1b1f' : hsl(color.hue, 28, 5),
      },
      logo: { url: '', placement: index % 2 ? 'top-left' : 'footer-left', size: 28 },
      canvas: {
        treatment: canvasTreatment,
        gradient: [base, accent],
        gridColor: light ? '#00000016' : '#ffffff20',
      },
      video: {
        layout: index % 2 ? 'split' : 'portrait-overlay',
        borderStyle: canvasTreatment === 'gradient' ? 'gradient' : 'solid',
        borderWidth: 8,
        borderRadius: index === 3 ? 4 : 28,
      },
      blocks: {
        title: index % 2 ? 'split' : 'statement',
        list: (['cards', 'timeline', 'steps', 'bullets'] as const)[index],
        code: index % 2 ? 'terminal' : 'panel',
        quote: index % 2 ? 'card' : 'bar',
        surface: index === 3 ? 'outline' : 'card',
        borderRadius: index === 3 ? 4 : 26,
      },
    })
  })
}

export const normalizeStudioTheme = (
  theme: StudioThemeV1 | undefined,
  legacyBrand: BrandTemplateV1 = defaultBrand,
): StudioThemeV1 => {
  if (!theme || theme.version !== 1) {
    return {
      ...defaultStudioTheme,
      brand: { ...defaultStudioTheme.brand, ...legacyBrand },
    }
  }
  const legacyLayout = theme.video?.layout as string | undefined
  const videoLayout = (
    {
      'picture-in-picture': 'information-circle',
      overlay: 'portrait-overlay',
      full: 'person-only',
    } as Record<string, StudioThemeV1['video']['layout']>
  )[legacyLayout || ''] || theme.video?.layout || defaultStudioTheme.video.layout
  return {
    ...defaultStudioTheme,
    ...theme,
    brand: { ...defaultStudioTheme.brand, ...theme.brand },
    logo: { ...defaultStudioTheme.logo, ...theme.logo },
    canvas: { ...defaultStudioTheme.canvas, ...theme.canvas },
    video: { ...defaultStudioTheme.video, ...theme.video, layout: videoLayout },
    blocks: { ...defaultStudioTheme.blocks, ...theme.blocks },
  }
}
