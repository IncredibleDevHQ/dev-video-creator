/* eslint-disable jsx-a11y/media-has-caption */
import * as Sentry from '@sentry/react'
import axios from 'axios'
import React, { useEffect, useState } from 'react'
import { ScreenState } from '../../components'
import {
  Content_Types,
  GetRecordingsQuery,
  RecordedBlocksFragment,
  SetupRecordingMutationVariables,
  StudioFragmentFragment,
  useGetRecordedBlocksLazyQuery,
  useGetRecordingsLazyQuery,
  useSetupRecordingMutation,
} from '../../generated/graphql'
import { useQuery } from '../../hooks'
import { BrandingJSON } from '../Branding/BrandingPage'
import { SimpleAST } from '../Flick/editor/utils/utils'

const Preload = ({
  fragment,
  setFragment,
  setView,
  setLocalVideoUrl,
  setRecordingsData,
}: {
  fragment: StudioFragmentFragment
  setFragment: React.Dispatch<
    React.SetStateAction<StudioFragmentFragment | undefined>
  >
  setView: React.Dispatch<
    React.SetStateAction<'preview' | 'preload' | 'studio'>
  >
  setLocalVideoUrl: React.Dispatch<React.SetStateAction<string | undefined>>
  setRecordingsData: React.Dispatch<
    React.SetStateAction<
      | {
          recordingId: string
          recordedBlocks: RecordedBlocksFragment[] | undefined
        }
      | undefined
    >
  >
}) => {
  const [loaded, setLoaded] = useState(false)
  const [progress, setProgress] = useState(0)

  const query = useQuery()
  const blockId = query.get('block')

  const [getRecordings] = useGetRecordingsLazyQuery({
    variables: {
      flickId: fragment?.flickId,
      fragmentId: fragment?.id,
    },
    fetchPolicy: 'cache-first',
  })

  const [getRecordedBlocks] = useGetRecordedBlocksLazyQuery()

  const [setupRecording] = useSetupRecordingMutation()

  const findOrSetupRecording = async (
    variables: SetupRecordingMutationVariables,
    recordingsData: GetRecordingsQuery | undefined
  ) => {
    if (!fragment?.configuration) return
    const recording = recordingsData?.Recording?.find(
      (recording) => recording.fragmentId === fragment.id
    )
    // console.log('Current recording is :', recording)
    // let blockGroups: any = []
    if (recording) {
      const { data: recordedBlocks } = await getRecordedBlocks({
        variables: {
          recordingId: recording.id,
        },
      })
      setRecordingsData({
        recordingId: recording.id,
        recordedBlocks: recordedBlocks?.Blocks || [],
      })
      return
    }
    const { data } = await setupRecording({ variables })

    setRecordingsData({
      recordingId: data?.StartRecording?.recordingId || '',
      recordedBlocks: [],
    })
  }

  const performPreload = async () => {
    preload({
      fragment,
      setLoaded,
      setFragment,
      setProgress,
      setLocalVideoUrl,
      blockId,
    })
  }

  useEffect(() => {
    ;(async () => {
      try {
        const { data: recordingsData, error: getRecordingsError } =
          await getRecordings()

        if (getRecordingsError) {
          throw new Error(getRecordingsError.message)
        }

        if (!recordingsData?.Recording) {
          throw new Error('No recordings found')
        }
        await findOrSetupRecording?.(
          {
            flickId: fragment.flick.id,
            fragmentId: fragment.id,
            contentType:
              fragment.configuration.mode === 'Portrait'
                ? Content_Types.VerticalVideo
                : Content_Types.Video,
            editorState: fragment.editorState,
            viewConfig: fragment.configuration?.blocks,
          },
          recordingsData
        )
        performPreload()
      } catch (e) {
        Sentry.captureException(
          `Error while getting recordings ${JSON.stringify(e)}`
        )
      }
    })()
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
  blockId,
  setLocalVideoUrl,
}: {
  fragment: StudioFragmentFragment
  setFragment: React.Dispatch<
    React.SetStateAction<StudioFragmentFragment | undefined>
  >
  setLoaded: React.Dispatch<React.SetStateAction<boolean>>
  setProgress: React.Dispatch<React.SetStateAction<number>>
  blockId: string | null
  setLocalVideoUrl: React.Dispatch<React.SetStateAction<string | undefined>>
}) => {
  let { editorState } = fragment
  let branding = fragment.flick.branding?.branding

  const promises: Promise<{
    key: string
    url: string | undefined
  }>[] = []

  if (editorState) {
    const mediaBlocks = (editorState as SimpleAST).blocks.filter(
      (block) => block.id === blockId
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
  const total =
    promises.length + (fragment.configuration?.mode === 'Portrait' ? 1 : 0)

  function tick(
    promise: Promise<{
      key: string
      url: string | undefined
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
          if (block.type === 'imageBlock' || block.type === 'videoBlock') {
            setLocalVideoUrl(result.find((res) => res?.key === block.id)?.url)
            return block
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
        branding: fragment.flick.branding
          ? {
              ...fragment.flick.branding,
              branding,
            }
          : undefined,
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
