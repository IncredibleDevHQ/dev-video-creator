import React, { useState } from 'react'
import Gravatar from 'react-gravatar'
import { SubscribeModal } from '.'
import { Text } from '../../../components'

const Collaborators = ({
  uniqueDetails,
}: {
  uniqueDetails: (string | undefined)[] | undefined
}) => {
  interface ModalState {
    isOpen: boolean
    name: string
    picture: string
    sub: string
  }
  const [modal, setModal] = useState<ModalState>({
    isOpen: false,
    name: '',
    picture: '',
    sub: '',
  })

  const individualUserDetails = (uniqueDetails as string[]).reduce(
    (rows: any, key, index) =>
      (index % 3 === 0 ? rows.push([key]) : rows[rows.length - 1].push(key)) &&
      rows,
    []
  )

  return (
    <div className="flex flex-col">
      {individualUserDetails?.map((collaborator: any) => {
        return (
          <div className="flex flex-row">
            {collaborator && (
              <>
                <div
                  className=""
                  aria-hidden
                  onClick={() =>
                    setModal({
                      isOpen: true,
                      name: collaborator[0],
                      picture: collaborator[2],
                      sub: collaborator[1],
                    })
                  }
                >
                  {collaborator[2] ? (
                    <img
                      src={collaborator[2]}
                      alt={collaborator[0] || 'user'}
                      className="w-12 h-12 mx-3 my-2 rounded-full border-blue-200 border-4 items-center"
                    />
                  ) : (
                    <Gravatar className="w-12 h-12 mx-3 my-2 rounded-full" />
                  )}
                </div>
                <div className="mx-3 my-2 ">
                  <Text className="mt-3">{collaborator[0]}</Text>
                </div>
              </>
            )}
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
        userSub={modal.sub}
      />
    </div>
  )
}

export default Collaborators
