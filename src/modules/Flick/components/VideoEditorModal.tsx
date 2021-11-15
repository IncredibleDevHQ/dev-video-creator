import { css, cx } from '@emotion/css'
import React from 'react'
import Modal from 'react-responsive-modal'
import { Heading } from '../../../components'
import { AssetDetailsFragment } from '../../../generated/graphql'
import { EditorProps, Transformations } from './VideoEditor'
import { VideoEditor } from '.'

interface VideoEditorModalProps extends Pick<EditorProps, 'url'> {
  open: boolean
  handleClose: () => void
  handleAction: (
    asset: AssetDetailsFragment,
    transformations: Transformations
  ) => Promise<void>
  asset: AssetDetailsFragment
  action: string
  editorWidth?: number
}

const VideoEditorModal = ({
  open,
  handleClose,
  asset,
  url,
  handleAction,
  action,
  editorWidth = 600,
}: VideoEditorModalProps) => {
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
          action={action}
          handleAction={async (transformations) => {
            handleAction(asset, transformations)
          }}
          width={editorWidth}
          transformations={asset.transformations || undefined}
        />
      </div>
    </Modal>
  )
}

export default VideoEditorModal
