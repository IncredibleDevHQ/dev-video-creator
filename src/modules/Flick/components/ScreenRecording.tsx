import { css, cx } from '@emotion/css'
import React, { useEffect, useState } from 'react'
import { Modal } from 'react-responsive-modal'
import useScreenRecorder from 'use-screen-recorder'
import { Button } from '../../../components'
import Video from '../../../components/Video'
import {
  Asset_Source_Enum_Enum,
  Asset_Type_Enum_Enum,
  useAddAssetMutation,
} from '../../../generated/graphql'
import { useUploadFile } from '../../../hooks/use-upload-file'

const ScreenRecording = ({
  open,
  handleClose,
}: {
  open: boolean
  handleClose: () => void
}) => {
  const {
    blobUrl,
    pauseRecording,
    resetRecording,
    resumeRecording,
    startRecording,
    status,
    stopRecording,
  } = useScreenRecorder({
    audio: true,
  })
  const [loadingAssets, setLoadingAssets] = useState<boolean>(false)
  const [video, setVideo] = useState<{
    url: string
    uuid: string
  }>()
  const [uploadVideo] = useUploadFile()

  const [addAssetMutation, { data, loading, error }] = useAddAssetMutation()

  const handleClick = async (file: string) => {
    const blob: Blob = await fetch(file).then((r) => r.blob())

    if (!blob) return

    setLoadingAssets(true)
    const video = await uploadVideo({
      // @ts-ignore
      extension: 'webm',
      file: blob,
    })

    setLoadingAssets(false)
    setVideo({ url: video.url, uuid: video.uuid })
  }

  useEffect(() => {
    if (!video) return

    setLoadingAssets(loading)
    addAssetMutation({
      variables: {
        displayName: video.uuid,
        objectLink: video.uuid,
        source: Asset_Source_Enum_Enum.WebClient,
        type: Asset_Type_Enum_Enum.Video,
      },
    })
  }, [video])

  useEffect(() => {
    handleClose()
  }, [data])

  return (
    <Modal
      open={open}
      onClose={() => {
        handleClose()
      }}
      classNames={{
        modal: cx(
          'rounded-lg w-3xl h-5xl md:w-1/2',
          css`
            background-color: #fffffff !important;
          `
        ),
        closeButton: css`
          svg {
            fill: #000000;
          }
        `,
      }}
    >
      <div className="flex flex-row gap-3  m-2">
        {status === 'idle' && (
          <Button
            type="button"
            appearance="primary"
            className="border-white h-auto"
            onClick={startRecording}
          >
            Start Recording
          </Button>
        )}
        {status === 'paused' && (
          <Button
            type="button"
            appearance="primary"
            className="border-white h-auto"
            onClick={resumeRecording}
          >
            Resume Recording
          </Button>
        )}
        {status === 'recording' && (
          <>
            <Button
              type="button"
              appearance="primary"
              className="border-white h-auto"
              onClick={stopRecording}
            >
              Stop Recording
            </Button>
            <Button
              type="button"
              appearance="primary"
              className="border-white h-auto"
              onClick={pauseRecording}
            >
              Pause Recording
            </Button>
          </>
        )}

        {status === 'stopped' && (
          <div className="flex flex-col gap-3 m-2 mt-8">
            <Video src={blobUrl || ''} />
            <div className="flex flex-row gap-3">
              <Button
                type="button"
                appearance="primary"
                className="border-white h-auto"
                loading={loadingAssets}
                onClick={() => handleClick(blobUrl as string)}
              >
                Upload Recording
              </Button>
              <Button
                type="button"
                appearance="primary"
                className="border-white h-auto"
                onClick={resetRecording}
              >
                Reset Recording
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

export default ScreenRecording
