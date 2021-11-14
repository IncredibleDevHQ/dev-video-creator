import { css, cx } from '@emotion/css'
import React from 'react'
import Modal from 'react-responsive-modal'
import { Heading } from '../../../components'
import {
  AssetDetailsFragment,
  useUpdateAssetTransformationsMutation,
} from '../../../generated/graphql'
import { EditorProps } from './VideoEditor'
import { VideoEditor } from '.'

interface VideoEditorModalProps extends Pick<EditorProps, 'url'> {
  open: boolean
  handleClose: () => void
  asset: AssetDetailsFragment
}

const VideoEditorModal = ({
  open,
  handleClose,
  asset,
  url,
}: VideoEditorModalProps) => {
  const [updateAssetTransformation] = useUpdateAssetTransformationsMutation()

  return (
    <Modal
      open={open}
      onClose={() => {
        handleClose()
      }}
      classNames={{
        modal: cx(
          'rounded-lg',
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
      <Heading fontSize="medium">Edit Video</Heading>
      <div className="mt-8 rounded-md overflow-hidden">
        <VideoEditor
          url={url}
          action="Save"
          handleAction={async (transformations) => {
            await updateAssetTransformation({
              variables: { transformations, id: asset.id },
            })

            handleClose()
          }}
          width={600}
          transformations={asset.transformations || undefined}
        />
      </div>
    </Modal>
  )
}

export default VideoEditorModal
