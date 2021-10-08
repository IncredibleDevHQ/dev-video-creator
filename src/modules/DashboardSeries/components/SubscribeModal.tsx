import React, { useState } from 'react'
import { Modal } from 'react-responsive-modal'
import Gravatar from 'react-gravatar'
import { css, cx } from '@emotion/css'
import { Heading, Text } from '../../../components'
import EmailSubscriber from './EmailSubscriber'
import { TargetTypes } from '../../../generated/graphql'

const SubscribeModal = ({
  open,
  handleClose,
  userName,
  userPhoto,
  userSub,
}: {
  open: boolean
  handleClose: (refresh?: boolean) => void
  userName: string
  userPhoto: string
  userSub: string
}) => {
  const firstName = userName?.split(' ') || ['']

  return (
    <Modal
      classNames={{
        modal: cx(
          'rounded-lg w-auto md:w-1/2',
          css`
            background-color: #9ef7ff !important
            border: #02737d !important
      ;
          `
        ),
        closeButton: css`
          svg {
            fill: #000000;
          }
        `,
      }}
      open={open}
      onClose={() => {
        handleClose(false)
      }}
      center
    >
      <div className="flex flex-col space-y-5 m-10 p-15">
        {userPhoto ? (
          <img
            src={userPhoto}
            alt={userName}
            className="w-32 h-32 inline-block align-middle rounded-xl max-w-screen-lg mx-auto"
          />
        ) : (
          <Gravatar className="w-32 h-32 inline-block align-middle max-w-screen-lg mx-auto items-center rounded-xl" />
        )}
        <Text className="text-center">{userName}</Text>

        <Heading className="text-xl mb-10 font-bold">
          We know you’re excited to know more about {firstName[0]} but we are
          working on public profiles, just hang in there.
        </Heading>
        <Text>
          Meanwhile, you can subscribe to {firstName[0]}’s flicks and get
          notified everytime he publishes one.
        </Text>
        <EmailSubscriber
          sourceID={userSub}
          target={TargetTypes.UserSubscription}
          handleClose={handleClose}
        />
      </div>
    </Modal>
  )
}

export default SubscribeModal
