/* eslint-disable jsx-a11y/media-has-caption */
import axios from 'axios'
import React, { useEffect, useState } from 'react'
import { useAuthState } from 'react-firebase-hooks/auth'
import { SetterOrUpdater, useRecoilValue, useSetRecoilState } from 'recoil'
import { ScreenState } from '../../../components'
import config from '../../../config'
import { StudioFragmentFragment } from '../../../generated/graphql'
import firebaseState from '../../../stores/firebase.store'
import {
  CodeBlockView,
  CodeTheme,
  ViewConfig,
} from '../../../utils/configTypes'
import { BrandingJSON } from '../../Branding/BrandingPage'
import {
  CodeBlock,
  CodeBlockProps,
  SimpleAST,
} from '../../Flick/editor/utils/utils'
import { getColorCodes } from '../effects/fragments/CodeFragment'
import { StudioProviderProps, studioStore } from '../stores'

const portraitStaticAssets = [
  {
    name: 'shortsBackgroundMusic',
    url: `${config.storage.baseUrl}music/scandinavianzAndromeda.mp3`,
  },
]

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
  const { auth } = useRecoilValue(firebaseState)
  const [user] = useAuthState(auth)

  const setStudio = useSetRecoilState(studioStore)

  const performPreload = async () => {
    const token = await user?.getIdToken()
    preload({ fragment, setLoaded, setFragment, setProgress, token, setStudio })
  }

  useEffect(() => {
    performPreload()
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
  token,
  setStudio,
}: {
  fragment: StudioFragmentFragment
  setFragment: React.Dispatch<
    React.SetStateAction<StudioFragmentFragment | undefined>
  >
  setLoaded: React.Dispatch<React.SetStateAction<boolean>>
  setProgress: React.Dispatch<React.SetStateAction<number>>
  token: string | undefined
  setStudio: SetterOrUpdater<StudioProviderProps<any, any>>
}) => {
  let { editorState } = fragment
  let branding = fragment.flick.branding?.branding

  const promises: Promise<{
    key: string
    url: string | undefined
    colorCodes: any | undefined
  }>[] = []

  if (editorState) {
    const mediaBlocks = (editorState as SimpleAST).blocks.filter(
      (block) => block.type === 'imageBlock' || block.type === 'videoBlock'
    )
    const codeBlocks = (editorState as SimpleAST).blocks.filter(
      (block) => block.type === 'codeBlock'
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
    promises.push(
      ...codeBlocks.map((block) => {
        const { id } = block
        const codeBlockViewProps = (fragment?.configuration as ViewConfig)
          .blocks[id]?.view as CodeBlockView
        return fetcher(
          id,
          undefined,
          (block as CodeBlockProps).codeBlock,
          codeBlockViewProps?.code.theme,
          token
        )
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

  const staticPromises =
    fragment.configuration?.mode === 'Portrait'
      ? portraitStaticAssets.map((asset) => fetchStatic(asset.name, asset.url))
      : []

  let loaded = 0
  const total =
    promises.length + (fragment.configuration?.mode === 'Portrait' ? 1 : 0)

  function tick(
    promise: Promise<{
      key: string
      url: string | undefined
      colorCodes: any | undefined
    }>
  ) {
    promise.then(() => {
      loaded += 1
      setProgress((loaded / total) * 100)
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
          if (block.type === 'codeBlock') {
            return {
              ...block,
              codeBlock: {
                ...block.codeBlock,
                colorCodes: result.find((res) => res?.key === block.id)
                  ?.colorCodes,
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

  function tickStatic(
    promise: Promise<{
      key: string
      blobUrl: string | undefined
    }>
  ) {
    promise.then(() => {
      loaded += 1
      setProgress((loaded / total) * 100)
    })
    return promise
  }

  Promise.all(staticPromises.map(tickStatic)).then((result) => {
    if (!result) return
    setStudio((prev) => ({
      ...prev,
      staticAssets: {
        shortsBackgroundMusic: result.find(
          (res) => res?.key === 'shortsBackgroundMusic'
        )?.blobUrl as string,
      },
    }))
  })
}

const fetchStatic = async (
  key: string,
  url: string
): Promise<{
  key: string
  blobUrl: string | undefined
}> => {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
    })
    const blobUrl = URL.createObjectURL(new Blob([response.data]))
    return { key, blobUrl }
  } catch (error) {
    return { key, blobUrl: undefined }
  }
}

const fetcher = async (
  key: string,
  url: string | undefined,
  codeBlock?: CodeBlock,
  codeTheme?: CodeTheme,
  userToken?: string | undefined
) => {
  if (codeBlock) {
    try {
      if (!codeBlock.code) throw Error('No code')
      if (!userToken) throw Error('No user token')
      const { data } = await getColorCodes(
        codeBlock.code as string,
        codeBlock.language || 'javascript',
        userToken,
        codeTheme || CodeTheme.DarkPlus
      )
      if (data?.errors) throw Error("Can't get color codes")
      return {
        key,
        url,
        colorCodes: data.data.TokenisedCode.data,
      }
    } catch (e) {
      return {
        key,
        url,
        colorCodes: undefined,
      }
    }
  }
  try {
    if (!url) throw Error('url is undefined')
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
    })
    const blobUrl = URL.createObjectURL(new Blob([response.data]))
    return {
      key,
      url: blobUrl,
      colorCodes: undefined,
    }
  } catch (e) {
    return {
      key,
      url,
      colorCodes: undefined,
    }
  }
}

export default Preload