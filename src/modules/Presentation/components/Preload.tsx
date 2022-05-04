/* eslint-disable jsx-a11y/media-has-caption */
import axios from 'axios'
import React, { useEffect, useState } from 'react'
import { useAuthState } from 'react-firebase-hooks/auth'
import { SetterOrUpdater, useRecoilValue, useSetRecoilState } from 'recoil'
import { ScreenState } from '../../../components'
import firebaseState from '../../../stores/firebase.store'
import { getColorCodes } from '../effects/fragments/CodeFragment'
import { presentationStore } from '../stores'
import { PresentationProviderProps } from '../stores/presentation.store'
import {
  BrandingJSON,
  CodeBlockView,
  CodeTheme,
  ViewConfig,
} from '../utils/configTypes'
import { CodeBlock, CodeBlockProps, SimpleAST } from '../utils/utils'

const Preload = ({
  setView,
  dataConfig,
  viewConfig,
  branding,
}: {
  setView: React.Dispatch<React.SetStateAction<'preload' | 'studio'>>
  dataConfig: any
  viewConfig: ViewConfig
  branding?: BrandingJSON | null
}) => {
  const [loaded, setLoaded] = useState(false)
  const [progress, setProgress] = useState(0)

  // const { getIdToken } = useRecoilValue(userState);
  const { auth } = useRecoilValue(firebaseState)
  const [user] = useAuthState(auth)
  const setStudio = useSetRecoilState(presentationStore)

  const performPreload = async () => {
    const token = await user?.getIdToken()
    preload({
      token,
      setStudio,
      setLoaded,
      setProgress,
      branding,
      viewConfig,
      dataConfig,
    })
  }

  useEffect(() => {
    performPreload()
  }, [])

  useEffect(() => {
    if (!loaded) return
    setView('studio')
  }, [loaded])

  return (
    <ScreenState
      title="Starting presentation.."
      subtitle={`${progress.toFixed(0)}%`}
    />
  )
}

const preload = async ({
  token,
  branding,
  setStudio,
  setLoaded,
  dataConfig,
  viewConfig,
  setProgress,
}: {
  dataConfig: any
  token: string | undefined
  viewConfig: ViewConfig
  branding: BrandingJSON | null | undefined
  setLoaded: React.Dispatch<React.SetStateAction<boolean>>
  setProgress: React.Dispatch<React.SetStateAction<number>>
  setStudio: SetterOrUpdater<PresentationProviderProps<any, any>>
}) => {
  const promises: Promise<{
    key: string
    url: string | undefined
    colorCodes: any | undefined
  }>[] = []

  let editorState = dataConfig

  if (dataConfig) {
    const mediaBlocks = (dataConfig as SimpleAST).blocks.filter(
      (block) => block.type === 'imageBlock' || block.type === 'videoBlock'
    )
    const codeBlocks = (dataConfig as SimpleAST).blocks.filter(
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
        const codeBlockViewProps = viewConfig.blocks[id]?.view as CodeBlockView
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

  let loaded = 0
  const total = promises.length + (viewConfig?.mode === 'Portrait' ? 1 : 0)

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

  let preloadedBlobs: {
    [key: string]: string | undefined
  } = {}

  Promise.all(promises.map(tick)).then((result) => {
    if (!result) return
    if (editorState) {
      editorState = {
        ...editorState,
        blocks: (editorState as SimpleAST).blocks.map((block) => {
          if (block.type === 'imageBlock' || block.type === 'videoBlock') {
            preloadedBlobs = {
              ...preloadedBlobs,
              [block.id]: result.find((res) => res?.key === block.id)?.url,
            }
            return block
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
      // eslint-disable-next-line no-param-reassign
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

    setStudio((prev) => ({
      ...prev,
      branding,
      viewConfig,
      dataConfig: editorState,
      preloadedBlobUrls: preloadedBlobs,
    }))

    setLoaded(true)
  })
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
        Buffer.from(codeBlock.code, 'base64').toString('utf8'),
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
