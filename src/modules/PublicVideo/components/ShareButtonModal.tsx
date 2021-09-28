/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable no-nested-ternary */
import Modal from 'react-responsive-modal'
import { css, cx } from '@emotion/css'
import React from 'react'
import { IoShareSocialOutline } from 'react-icons/io5'
import { ASSETS } from '../../../constants'
import { Heading } from '../../../components'

const ShareButtonModal = ({
  open,
  handleClose,
  link,
}: {
  open: boolean
  handleClose: () => void
  link: string
}) => {
  return (
    <Modal
      open={open}
      onClose={() => {
        handleClose()
      }}
      classNames={{
        modal: cx(
          'rounded-lg w-2/4 ',
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
      <div className="m-8 w-auto">
        <div
          className="flex flex-row border-2 p-6"
          onClick={() => window.open(link, '_blank')}
        >
          <img
            className="w-7 h-7"
            alt="incredible.dev"
            src={ASSETS.ICONS.TWITTER_LOGO}
          />
          <Heading className="flex w-full text-base font-normal ml-2">
            Share the flick on Twitter
          </Heading>

          <IoShareSocialOutline size={25} className="ml-5" />
          <Heading className="flex font-semibold ml-3 text-base">Share</Heading>
        </div>
      </div>
    </Modal>
  )
}

export default ShareButtonModal
