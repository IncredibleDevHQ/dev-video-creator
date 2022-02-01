/* eslint-disable jsx-a11y/media-has-caption */
import axios from 'axios'
import React, { useEffect, useState } from 'react'
import { ScreenState } from '../../../components'
import { StudioFragmentFragment } from '../../../generated/graphql'
import { BrandingJSON } from '../../Branding/BrandingPage'
import { SimpleAST } from '../../Flick/editor/utils/utils'

const Preload = ({
  fragment,
  setFragment,
  setView,
}: {
  fragment: StudioFragmentFragment
  setFragment: React.Dispatch<
    React.SetStateAction<StudioFragmentFragment | undefined>
  >
  setView: React.Dispatch<
    React.SetStateAction<'preview' | 'preload' | 'studio'>
  >
}) => {
  const [loaded, setLoaded] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    preload({ fragment, setLoaded, setFragment, setProgress })
  }, [])

  useEffect(() => {
    if (!loaded) return
    setView('preview')
  }, [loaded])

  return (
    <ScreenState title="Starting studio" subtitle={`${progress.toFixed(0)}%`} />
  )
}

const preload = async ({
  fragment,
  setFragment,
  setLoaded,
  setProgress,
}: {
  fragment: StudioFragmentFragment
  setFragment: React.Dispatch<
    React.SetStateAction<StudioFragmentFragment | undefined>
  >
  setLoaded: React.Dispatch<React.SetStateAction<boolean>>
  setProgress: React.Dispatch<React.SetStateAction<number>>
}) => {
  let { editorState } = fragment
  let branding = fragment.flick.branding?.branding

  const promises: Promise<{
    key: string
    url: string | undefined
  }>[] = []

  if (editorState) {
    const mediaBlocks = (editorState as SimpleAST).blocks.filter(
      (block) => block.type === 'imageBlock' || block.type === 'videoBlock'
    )
    promises.push(
      ...mediaBlocks.map((block) => {
        const { id } = block
        let url = ''
        if (block.type === 'imageBlock') {
          url = block.imageBlock.url as string
        } else if (block.type === 'videoBlock') {
          url = block.videoBlock.url as string
        }
        return fetcher(id, url)
      })
    )
  }

  if (branding) {
    const brand = branding as BrandingJSON
    promises.push(
      fetcher('logo', brand.logo),
      fetcher('background', brand.background?.url),
      fetcher('introVideoUrl', brand.introVideoUrl)
    )
  }

  let loaded = 0

  function tick(promise: Promise<{ key: string; url: string | undefined }>) {
    promise.then(() => {
      loaded += 1
      setProgress((loaded / promises.length) * 100)
    })
    return promise
  }

  Promise.all(promises.map(tick)).then((result) => {
    if (!result) return
    if (editorState) {
      editorState = {
        ...editorState,
        blocks: (editorState as SimpleAST).blocks.map((block) => {
          if (block.type === 'imageBlock') {
            return {
              ...block,
              imageBlock: {
                ...block.imageBlock,
                url: result.find((res) => res?.key === block.id)?.url,
              },
            }
          }
          if (block.type === 'videoBlock') {
            return {
              ...block,
              videoBlock: {
                ...block.videoBlock,
                url: result.find((res) => res?.key === block.id)?.url,
              },
            }
          }
          return block
        }),
      }
    }

    if (branding) {
      branding = {
        ...branding,
        logo: result.find((res) => res?.key === 'logo')?.url,
        background: {
          ...branding.background,
          url: result.find((res) => res?.key === 'background')?.url,
        },
        introVideoUrl: result.find((res) => res?.key === 'introVideoUrl')?.url,
      }
    }

    setFragment({
      ...fragment,
      editorState,
      flick: {
        ...fragment.flick,
        branding,
      },
    })

    setLoaded(true)
  })
}

const fetcher = async (key: string, url: string | undefined) => {
  try {
    if (!url) throw Error('url is undefined')
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
    })
    const blobUrl = URL.createObjectURL(new Blob([response.data]))
    return {
      key,
      url: blobUrl,
    }
  } catch (e) {
    return {
      key,
      url,
    }
  }
}

export default Preload
