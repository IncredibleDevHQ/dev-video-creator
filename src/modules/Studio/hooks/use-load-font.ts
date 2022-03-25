import { useEffect } from 'react'
import useFontFaceObserver from 'use-font-face-observer'

type Font = {
  family: string
  url?: string
  type: 'google' | 'custom'
  weights: (
    | 'light'
    | 'normal'
    | 'bold'
    | 'bolder'
    | '100'
    | '200'
    | '300'
    | '400'
    | '500'
    | '600'
    | '700'
    | '800'
    | '900'
    | undefined
  )[]
}

const createLink = (fonts: Font[]) => {
  const families = fonts
    .reduce((acc: any, font: Font) => {
      const family = font.family.replace(/ +/g, '+')
      const weights = (font.weights || []).join(',')

      return [...acc, family + (weights && `:${weights}`)]
    }, [])
    .join('|')

  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css?family=${families}`
  document.head.appendChild(link)
}

const createCustomLink = (fonts: Font[]) => {
  const fontFacesString = fonts
    .map((font) => {
      const fontFace = `
      @font-face {
        font-family: '${font.family}';
        src: url('${font.url}');
      }
    `
      return fontFace
    })
    .join('')
  const file = new File([fontFacesString], 'customFonts.css', {
    type: 'text/css',
  })
  const url = URL.createObjectURL(file)
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = url
  document.head.appendChild(link)
}

export const loadFonts = (fonts: Font[]) => {
  const loadedFonts: string[] = []
  document.fonts.forEach((f) => loadedFonts.push(f.family))
  const customFonts = fonts.filter(
    (font) => font.type === 'custom' && !loadedFonts.includes(font.family)
  )
  const googleFonts = fonts.filter(
    (font) => font.type === 'google' && !loadedFonts.includes(font.family)
  )
  if (googleFonts.length > 0) createLink(googleFonts)
  if (customFonts.length > 0) createCustomLink(customFonts)
}

/** A simple, stupid hook to ensure that if a Google Font is passed, it is loaded */
const useLoadFont = (fonts: Font[]) => {
  useEffect(() => {
    const customFonts = fonts.filter((font) => font.type === 'custom')
    const googleFonts = fonts.filter((font) => font.type === 'google')
    if (googleFonts.length > 0) createLink(fonts)
    if (customFonts.length > 0) createCustomLink(fonts)
  }, [fonts])

  const loaded = useFontFaceObserver(
    fonts.filter((f) => f.type === 'google').map((f) => ({ family: f.family }))
  )

  return { isFontLoaded: loaded }
}

export default useLoadFont
