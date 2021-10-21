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
          collaborator && (
            <div className="flex items-center">
              <div className="" aria-hidden>
                {collaborator[2] ? (
                  <img
                    src={collaborator[2]}
                    alt={collaborator[0] || 'user'}
                    className="w-10 h-10 my-2 rounded-full border-blue-200 border-4 items-center"
                  />
                ) : (
                  <Gravatar className="w-10 h-10 mx-3 my-2 rounded-full" />
                )}
              </div>
              <Text className="text-sm ml-3">{collaborator[0]}</Text>
            </div>
          )
        )
      })}
    </div>
  )
}

export default Collaborators
