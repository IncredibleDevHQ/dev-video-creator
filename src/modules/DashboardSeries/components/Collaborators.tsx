/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/no-static-element-interactions */
import React, { useState } from 'react'
import Gravatar from 'react-gravatar'
import { array } from 'yup/lib/locale'
import { SubscribeModal } from '.'
import { Text } from '../../../components'
import { BaseFlickFragment, Maybe } from '../../../generated/graphql'

const Collaborators = ({ flick }: { flick: BaseFlickFragment }) => {
  interface ModalState {
    isOpen: boolean
    name: string
    picture: string
    username: string
  }
  const [modal, setModal] = useState<ModalState>({
    isOpen: false,
    name: '',
    picture: '',
    username: '',
  })

  return (
    <div className="flex flex-col">
      {flick.participants?.find((collaborator) => {
        return (
          <div className="flex flex-row">
            <div
              className=""
              onClick={() =>
                setModal({
                  isOpen: true,
                  name: collaborator.user.displayName || '',
                  picture: collaborator.user.picture || '',
                  username: collaborator.user.username,
                })
              }
            >
              {collaborator.user.picture ? (
                <img
                  src={collaborator.user.picture}
                  alt={collaborator.user.displayName || 'user'}
                  className="w-12 h-12 mx-3 my-2 rounded-full border-blue-200 border-4 items-center"
                />
              ) : (
                <Gravatar className="w-12 h-12 mx-3 my-2 rounded-full" />
              )}
            </div>
            <div className="mx-3 my-2 ">
              <Text>{collaborator.user.displayName}</Text>
              <Text>{collaborator.user.username}</Text>
            </div>
          </div>
        )
      })}

      <SubscribeModal
        open={modal.isOpen}
        handleClose={() => {
          setModal((prev) => ({
            ...prev,
            isOpen: false,
          }))
        }}
        userName={modal.name}
        userPhoto={modal.picture}
        userUsername={modal.username}
      />
    </div>
  )
}

export default Collaborators
