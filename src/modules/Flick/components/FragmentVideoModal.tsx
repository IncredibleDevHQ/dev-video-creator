import { css, cx } from '@emotion/css'
import React from 'react'
import { Modal } from 'react-responsive-modal'
import { useRecoilValue } from 'recoil'
import { Video } from '../../../components'
import config from '../../../config'
import { Content_Type_Enum_Enum } from '../../../generated/graphql'
import { newFlickStore } from '../store/flickNew.store'

const FragmentVideoModal = ({
  open,
  contentType,
  handleClose,
}: {
  open: boolean
  contentType: Content_Type_Enum_Enum
  handleClose: () => void
}) => {
  const { flick, activeFragmentId } = useRecoilValue(newFlickStore)

  const fragment = flick?.fragments.find((f) => f.id === activeFragmentId)

  return (
    <Modal
      open={open}
      onClose={() => {
        handleClose()
      }}
      center
      styles={{
        modal: {
          maxHeight: '90vh',
          maxWidth: `${
            contentType === Content_Type_Enum_Enum.Video ? '80%' : '25%'
          }`,
        },
      }}
      classNames={{
        modal: cx(
          'rounded-lg w-full',
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
      showCloseIcon={false}
    >
      <div>
        {(fragment?.producedLink || fragment?.producedShortsLink) && (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <Video
            src={
              config.storage.baseUrl +
              (contentType === Content_Type_Enum_Enum.VerticalVideo
                ? fragment.producedShortsLink
                : fragment.producedLink)
            }
          />
        )}
      </div>
    </Modal>
  )
}

export default FragmentVideoModal
