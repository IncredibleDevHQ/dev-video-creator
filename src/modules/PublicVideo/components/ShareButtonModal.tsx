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
          'rounded-lg w-1/4 ',
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
          className="flex w-auto border-2"
          onClick={() => window.open(link, '_blank')}
        >
          <img
            className=" ml-4 mt-5 mb-5"
            alt="incredible.dev"
            src={ASSETS.ICONS.TWITTER_LOGO}
          />
          <Heading className=" flex ml-4 mt-5  w-full text-sm font-normal">
            Share the flick on Twitter
          </Heading>
          <div className="flex flex-row mr-4 mt-5 place-items-end">
            <IoShareSocialOutline />
            <Heading className="flex font-semibold ml-2 text-sm">Share</Heading>
          </div>
        </div>
        <div className="flex mt-5 w-auto border-2">
          <img
            className=" ml-4 mt-5 mb-5"
            alt="incredible.dev"
            src={ASSETS.ICONS.SLACK_LOGO}
          />
          <Heading className=" flex ml-4 mt-5  w-full text-sm font-normal">
            Share the flick on Slack
          </Heading>
          <div className="flex flex-row mr-4 mt-5 place-items-end">
            <IoShareSocialOutline />
            <Heading className="flex font-semibold ml-2 text-sm">Share</Heading>
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default ShareButtonModal
