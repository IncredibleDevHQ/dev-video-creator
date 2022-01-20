import { useEffect, useState } from 'react'
import useFontFaceObserver from 'use-font-face-observer'

type Font = {
  family: string
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

  return link
}

/** A simple, stupid hook to ensure that if a Google Font is passed, it is loaded */
const useLoadFont = (fonts: Font[]) => {
  const [link, setLink] = useState<HTMLLinkElement>()

  useEffect(() => {
    if (fonts.length === 0 || !link) return

    document.head.appendChild(link)

    // eslint-disable-next-line consistent-return
    return () => {
      document.head.removeChild(link)
    }
  }, [link])

  useEffect(() => {
    setLink(createLink(fonts))
  }, [fonts])

  const loaded = useFontFaceObserver(fonts.map((f) => ({ family: f.family })))

  return { isFontLoaded: loaded }
}

export default useLoadFont
