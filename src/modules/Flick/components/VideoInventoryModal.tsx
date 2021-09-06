import { css, cx } from '@emotion/css'
import React, { useState } from 'react'
import Modal from 'react-responsive-modal'
import { Button, Heading, ScreenState } from '../../../components'
import Video from '../../../components/Video'
import { useUserAssetQuery } from '../../../generated/graphql'

import { ScreenRecording } from './index'
import UploadVideoModal from './UploadVideoModal'

const VideoInventoryModal = ({
  open,
  handleClose,
  setChoosenLink,
}: {
  open: boolean
  handleClose: () => void
  setChoosenLink: React.Dispatch<React.SetStateAction<string>>
}) => {
  const [screenRecordModal, setScreenRecordModal] = useState<boolean>(false)
  const [uploadFileModal, setUploadFileModal] = useState<boolean>(false)

  const { data, loading, error, refetch } = useUserAssetQuery()

  if (error)
    return (
      <ScreenState title="Something went wrong!!" subtitle={error.message} />
    )

  return (
    <Modal
      open={open}
      onClose={() => {
        handleClose()
      }}
      classNames={{
        modal: cx(
          'rounded-lg w-96% h-50%',
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
      <Heading>Videos </Heading>
      <div className="flex flex-row gap-1 justify-end mt-6">
        <Button
          type="button"
          appearance="secondary"
          className="border-white h-auto bg-gray-100 text-black"
          onClick={() => setUploadFileModal(true)}
        >
          Upload Video
        </Button>
        <Button
          type="button"
          appearance="secondary"
          onClick={() => setScreenRecordModal(true)}
          className="border-white h-auto bg-gray-100 text-black"
        >
          ScreenRecord
        </Button>
      </div>
      <div className="grid grid-cols-3 m-4 gap-4 ">
        {data &&
          data.Asset.length > 0 &&
          data.Asset.map((asset) => (
            <div
              className="max-w-2xl flex content-center bg-gray-800"
              onClick={() => {
                setChoosenLink(
                  'https://incredible-uploads-staging.s3.amazonaws.com/' +
                    asset.objectLink
                )
                handleClose()
              }}
            >
              <video
                width={400}
                height={225}
                src={
                  'https://incredible-uploads-staging.s3.amazonaws.com/' +
                  asset.objectLink
                }
                controls
              />
            </div>
          ))}
      </div>
      {loading && <ScreenState title="Just a moment..." loading />}
      <ScreenRecording
        open={screenRecordModal}
        handleClose={() => {
          setScreenRecordModal(false)
          refetch()
        }}
      ></ScreenRecording>
      <UploadVideoModal
        open={uploadFileModal}
        handleClose={() => {
          setUploadFileModal(false)
          refetch()
        }}
      ></UploadVideoModal>
    </Modal>
  )
}

export default VideoInventoryModal
