import { css, cx } from '@emotion/css'
import React from 'react'
import { Modal } from 'react-responsive-modal'
import { useRecoilValue } from 'recoil'
import { Video } from '../../../components'
import config from '../../../config'
import { newFlickStore } from '../store/flickNew.store'

const FragmentVideoModal = ({
  open,
  handleClose,
}: {
  open: boolean
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
          maxWidth: '80%',
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
        {fragment?.producedLink && (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <Video
            className="w-full"
            src={config.storage.baseUrl + fragment.producedLink}
          />
        )}
      </div>
    </Modal>
  )
}

export default FragmentVideoModal
