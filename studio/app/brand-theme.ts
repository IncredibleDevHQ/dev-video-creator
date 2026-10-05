import { escape } from './ui'
export type ThemeColours = {
  ground: string
  text: string
  accent: string
  secondary: string
}
export const readableInk = (hex: string) => {
  const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const luminance = rgb.map((v) =>
    v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  )
  return luminance[0] * 0.2126 + luminance[1] * 0.7152 + luminance[2] * 0.0722 >
    0.179
    ? '#111719'
    : '#ffffff'
}
export const themeChoices = (brand: ThemeColours) => [
  { name: 'Original', ...brand },
  { name: 'Ink', ...brand, ground: brand.text, text: readableInk(brand.text) },
  {
    name: 'Accent',
    ...brand,
    ground: brand.accent,
    text: readableInk(brand.accent),
    accent: brand.text
  },
  {
    name: 'Soft',
    ...brand,
    ground: brand.secondary,
    text: readableInk(brand.secondary)
  }
]
export const titlePreview = (
  title: string,
  name: string,
  colours: ThemeColours
) =>
  `<span class="theme-title-slide" style="--sample-ground:${colours.ground};--sample-text:${colours.text};--sample-accent:${colours.accent};--sample-secondary:${colours.secondary}"><span class="theme-sample-brand">${escape(name || 'Your story')}</span><strong>${escape(title)}</strong><span class="theme-sample-rule"></span><span class="theme-sample-caption">Ideas worth sharing.</span><span class="theme-sample-art" aria-hidden="true"></span></span>`
