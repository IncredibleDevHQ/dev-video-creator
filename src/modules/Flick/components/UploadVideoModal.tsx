import React, { useEffect, useState } from 'react'
import Modal from 'react-responsive-modal'
import { css, cx } from '@emotion/css'
import Video from '../../../components/UploadVideo'
import { useUploadFile } from '../../../hooks/use-upload-file'
import { Heading } from '../../../components'
import {
  Asset_Source_Enum_Enum,
  Asset_Type_Enum_Enum,
  useAddAssetMutation,
} from '../../../generated/graphql'

const UploadVideoModal = ({
  open,
  handleClose,
}: {
  open: boolean
  handleClose: () => void
}) => {
  const [loadingAssets, setLoadingAssets] = useState<boolean>(false)
  const [video, setVideo] = useState<{
    url: string
    uuid: string
  }>()
  const [uploadVideo] = useUploadFile()
  const [addAssetMutation, { data, loading, error }] = useAddAssetMutation()

  const handleClick = async (file: File) => {
    if (!file) return

    setLoadingAssets(true)
    const video = await uploadVideo({
      // @ts-ignore
      extension: file.name.split('.')[1],
      file,
    })
    setLoadingAssets(false)
    setVideo({ url: video.url, uuid: video.uuid })
  }

  useEffect(() => {
    if (!video) return

    setLoadingAssets(loading)
    addAssetMutation({
      variables: {
        displayName: video ? video.uuid : '',
        objectLink: video ? video.uuid : '',
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
      {video && video.url && !loadingAssets && (
        <video height="200px" src={video?.url} controls />
      )}
      {loadingAssets && (
        <Heading className="text-xl font-semibold">Uploading...</Heading>
      )}
    </Modal>
  )
}

export default UploadVideoModal
