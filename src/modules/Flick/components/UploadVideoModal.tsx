import React, { useState } from 'react'
import Modal from 'react-responsive-modal'
import { css, cx } from '@emotion/css'
import Video from '../../../components/Video'
import { useUploadFile } from '../../../hooks/use-upload-file'
import { Heading } from '../../../components'

const UploadVideoModal = ({
  open,
  handleClose,
}: {
  open: boolean
  handleClose: () => void
}) => {
  const [loadingAssets, setLoadingAssets] = useState<boolean>(false)
  const [video, setVideo] = useState<string>()
  const [uploadVideo] = useUploadFile()

  const handleClick = async (file: File) => {
    if (!file) return

    setLoadingAssets(true)
    const video = await uploadVideo({
      // @ts-ignore
      extension: file.name.split('.')[1],
      file,
    })
    setLoadingAssets(false)
    setVideo(video.url)
  }
  return (
    <Modal
      open={open}
      onClose={() => {
        handleClose()
      }}
      classNames={{
        modal: cx(
          'rounded-lg w-3xl h-1/2',
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
      <Video
        className="text-lg m-4"
        onChange={(e) =>
          // @ts-ignore
          e.target.files?.[0] && handleClick(e.target.files[0])
        }
      ></Video>
      {video && !loadingAssets && (
        <video height="200px" src={video || ''} controls />
      )}
      {loadingAssets && (
        <Heading className="text-xl font-semibold">Uploading...</Heading>
      )}
    </Modal>
  )
}

export default UploadVideoModal
