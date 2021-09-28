import React from 'react'
import { Modal } from 'react-responsive-modal'
import { Link } from 'react-router-dom'
import { useRecoilValue } from 'recoil'
import Gravatar from 'react-gravatar'
import { css, cx } from '@emotion/css'
import { Button, Heading, Video, Text } from '../../../components'
import { BaseFlickFragment } from '../../../generated/graphql'
import config from '../../../config'
import { ProfileDetails } from '../../Profile/components'
import { User, userState } from '../../../stores/user.store'
import { EmailSubscriber } from '../PublicView'

const SubscribeModal = ({
  open,
  handleClose,
}: {
  open: boolean
  handleClose: (refresh?: boolean) => void
}) => {
  const { baseUrl } = config.storage
  const userData = (useRecoilValue(userState) as User) || {}
  const firstName = userData.displayName?.split(' ') || ['']

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
      <div className="flex flex-col items-center space-y-5 m-10 p-15">
        <div className="items-center justify-center">
          {userData.picture ? (
            <img
              src={userData.picture}
              alt={userData.displayName || 'user'}
              className="w-32 h-32 mx-3 my-2 rounded-xl"
            />
          ) : (
            <Gravatar
              className="w-32 h-32 mx-3 my-2 rounded-xl"
              email={userData.email as string}
            />
          )}
          <Text className="text-center">{userData.displayName}</Text>
          <Text className="text-center">{userData.username}</Text>
        </div>
        <Heading className="text-xl mb-10 font-bold">
          We know you’re excited to know more about {firstName[0]} but we are
          working on public profiles, just hang in there.
        </Heading>
        <Text>
          Meanwhile, you can subscribe to {firstName[0]}’s flicks and get
          notified everytime he publishes one.
        </Text>
        <EmailSubscriber />
      </div>
    </Modal>
  )
}

export default SubscribeModal
