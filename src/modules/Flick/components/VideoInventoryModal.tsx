import { css, cx } from '@emotion/css'
import React, { useState } from 'react'
import { FiMonitor, FiUploadCloud } from 'react-icons/fi'
import Modal from 'react-responsive-modal'
import { Button, Heading, ScreenState } from '../../../components'
import Video from '../../../components/UploadVideo'
import config from '../../../config'
import { useUserAssetQuery } from '../../../generated/graphql'

import { ScreenRecording } from './index'
import UploadVideoModal from './UploadVideoModal'

const VideoInventoryModal = ({
  open,
  handleClose,
  setSelectedVideoLink,
}: {
  open: boolean
  handleClose: () => void
  setSelectedVideoLink: React.Dispatch<React.SetStateAction<string>>
}) => {
  const { baseUrl } = config.storage
  const [screenRecordModal, setScreenRecordModal] = useState<boolean>(false)
  const [uploadFileModal, setUploadFileModal] = useState<boolean>(false)

  const { data, loading, error, refetch } = useUserAssetQuery()

  if (error)
    return (
      <ScreenState title="Something went wrong!" subtitle={error.message} />
    )

  return (
    <Modal
      open={open}
      onClose={() => {
        handleClose()
      }}
      classNames={{
        modal: cx(
          'rounded-lg w-3/4 h-1/2',
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
      <Heading>Videos</Heading>
      <div className="grid grid-cols-2 gap-x-4 justify-end mt-6">
        <Button
          type="button"
          appearance="primary"
          className="border-white h-auto bg-gray-100 text-black"
          onClick={() => setUploadFileModal(true)}
          icon={FiUploadCloud}
          size="extraSmall"
        >
          Upload a File
        </Button>
        <Button
          type="button"
          appearance="primary"
          onClick={() => setScreenRecordModal(true)}
          icon={FiMonitor}
          className="border-white h-auto bg-gray-100 text-black"
          size="extraSmall"
        >
          Record Your Screen
        </Button>
      </div>
      <div className="grid grid-cols-3 m-4 gap-4 ">
        {data &&
          data.Asset.length > 0 &&
          data.Asset.map((asset) => (
            <div
              className="max-w-2xl flex content-center bg-gray-800"
              onClick={() => {
                setSelectedVideoLink(baseUrl + asset.objectLink)
                handleClose()
              }}
            >
              <video width={400} height={225} controls>
                <source src={baseUrl + asset.objectLink} type="video/mp4" />
              </video>
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
      />
      <UploadVideoModal
        open={uploadFileModal}
        handleClose={() => {
          setUploadFileModal(false)
          refetch()
        }}
      />
    </Modal>
  )
}

export default VideoInventoryModal
