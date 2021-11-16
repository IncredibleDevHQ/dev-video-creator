import { ApolloQueryResult } from '@apollo/client'
import { css, cx } from '@emotion/css'
import React, { useState } from 'react'
import { FiEdit2, FiMonitor, FiUploadCloud } from 'react-icons/fi'
import Modal from 'react-responsive-modal'
import { Button, Heading } from '../../../components'
import config from '../../../config'
import {
  AssetDetailsFragment,
  Exact,
  UserAssetQuery,
  useUpdateAssetTransformationsMutation,
} from '../../../generated/graphql'
import { ScreenRecording, VideoEditorModal } from './index'
import UploadVideoModal from './UploadVideoModal'

const VideoInventoryModal = ({
  open,
  handleClose,
  setSelectedVideoLink,
  assetsData,
  refetchAssetsData,
}: {
  open: boolean
  handleClose: () => void
  setSelectedVideoLink: React.Dispatch<React.SetStateAction<string>>
  assetsData: UserAssetQuery | undefined
  refetchAssetsData: (
    variables?:
      | Partial<
          Exact<{
            [key: string]: never
          }>
        >
      | undefined
  ) => Promise<ApolloQueryResult<UserAssetQuery>>
}) => {
  const { baseUrl } = config.storage
  const [screenRecordModal, setScreenRecordModal] = useState(false)
  const [uploadFileModal, setUploadFileModal] = useState(false)

  const [editAsset, setEditAsset] = useState<AssetDetailsFragment | null>(null)

  const [updateAssetTransformation] = useUpdateAssetTransformationsMutation()

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
        {assetsData?.Asset.map((asset) => (
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
          refetchAssetsData()
        }}
      />
      <UploadVideoModal
        open={uploadFileModal}
        handleClose={() => {
          setUploadFileModal(false)
          refetchAssetsData()
        }}
      />

      {editAsset && (
        <VideoEditorModal
          open={editAsset !== null}
          handleClose={() => {
            setEditAsset(null)
          }}
          action="Save"
          handleAction={async (asset, transformations) => {
            await updateAssetTransformation({
              variables: { transformations, id: asset.id },
            })

            setEditAsset(null)
            refetchAssetsData()
          }}
          asset={editAsset}
          url={baseUrl + editAsset.objectLink}
        />
      )}
    </Modal>
  )
}

export default VideoInventoryModal
