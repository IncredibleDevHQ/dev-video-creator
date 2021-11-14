import { css, cx } from '@emotion/css'
import React, { useState } from 'react'
import { FiEdit2, FiMonitor, FiUploadCloud } from 'react-icons/fi'
import Modal from 'react-responsive-modal'
import { Button, Heading, ScreenState } from '../../../components'
import config from '../../../config'
import {
  AssetDetailsFragment,
  useUserAssetQuery,
} from '../../../generated/graphql'
import { ScreenRecording, VideoEditorModal } from './index'
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
  const [screenRecordModal, setScreenRecordModal] = useState(false)
  const [uploadFileModal, setUploadFileModal] = useState(false)

  const [editAsset, setEditAsset] = useState<AssetDetailsFragment | null>(null)

  const { data, error, refetch } = useUserAssetQuery()

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
      <div className="grid grid-cols-3 m-4 gap-4">
        {data?.Asset.map((asset) => (
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
          <div
            className="shadow-md relative transition-all cursor-pointer hover:shadow-2xl bg-white p-2 rounded-md"
            key={asset.id}
            onClick={() => {
              setSelectedVideoLink(baseUrl + asset.objectLink)
              handleClose()
            }}
          >
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video className="rounded-md" controls>
              <source src={baseUrl + asset.objectLink} type="video/mp4" />
            </video>
            {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
            <div
              onClick={(e) => {
                e.stopPropagation()
                setEditAsset(asset)
              }}
              className="cursor-pointer flex items-center justify-center absolute top-4 right-4 bg-white shadow-md p-1 rounded-md"
            >
              <FiEdit2 />
            </div>
          </div>
        ))}
      </div>

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

      {editAsset && (
        <VideoEditorModal
          open={editAsset !== null}
          handleClose={() => {
            setEditAsset(null)

            refetch()
          }}
          asset={editAsset}
          url={baseUrl + editAsset.objectLink}
        />
      )}
    </Modal>
  )
}

export default VideoInventoryModal
