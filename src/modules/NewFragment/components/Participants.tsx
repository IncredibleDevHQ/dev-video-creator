import { css, cx } from '@emotion/css'
import React, { ChangeEvent, useState } from 'react'
import {
  BiArrowBack,
  BiCheckCircle,
  BiCircle,
  BiRightArrowAlt,
} from 'react-icons/bi'
import Select from 'react-select'
import { Form, FormParticipant } from '.'
import { Button, Heading, TextField } from '../../../components'
import { Flick, Participant_Role_Enum_Enum } from '../../../generated/graphql'

const style = css`
  .react-select__control {
    box-shadow: none;
    border-width: 2px;
    border-color: rgb(156, 163, 175);
  }

  .react-select__control:hover,
  .react-select__control:focus {
    box-shadow: none;
    border-color: #5156ea;
  }
`

const Participants = ({
  handlePrevious,
  handleNext,
  flick,
  form,
  loading,
}: {
  handlePrevious: (participants: FormParticipant[]) => void
  handleNext: (participants: FormParticipant[]) => void
  flick: Flick
  form: Form
  loading: boolean
}) => {
  const [participants, setParticipants] = useState<FormParticipant[]>(
    form.participants || []
  )
  const [query, setQuery] = useState('')

  return (
    <div>
      <TextField
        label="Search"
        placeholder="Search..."
        onChange={(e: ChangeEvent<HTMLInputElement>) =>
          setQuery(e.target.value)
        }
      />
      <div className="mt-8 flex flex-col max-h-80 min-h-48 overflow-scroll">
        {flick.participants
          .filter((p) =>
            query.trim().length > 0
              ? p.user.displayName
                  ?.toLowerCase()
                  .startsWith(query.toLowerCase())
              : true
          )
          .map((participant) => {
            const options = [
              {
                value: Participant_Role_Enum_Enum.Assistant,
                label: Participant_Role_Enum_Enum.Assistant,
              },
              {
                value: Participant_Role_Enum_Enum.Host,
                label: Participant_Role_Enum_Enum.Host,
              },
              {
                value: Participant_Role_Enum_Enum.Viewer,
                label: Participant_Role_Enum_Enum.Viewer,
              },
            ]

            const selected = participants.find((p) => p.id === participant.id)

            const [showUsername, setShowUsername] = useState(false)

            return (
              <div
                className={cx('flex items-center justify-between my-3', style)}
                key={participant.id}
              >
                <div className="flex items-center">
                  {selected ? (
                    <BiCheckCircle
                      size={24}
                      className="text-green-600"
                      onClick={() =>
                        setParticipants((participants) =>
                          participants.filter((p) => p.id !== selected.id)
                        )
                      }
                    />
                  ) : (
                    <BiCircle
                      size={24}
                      className="text-gray-400"
                      onClick={() =>
                        setParticipants(() => [
                          ...participants,
                          {
                            ...participant,
                            role: Participant_Role_Enum_Enum.Assistant,
                          },
                        ])
                      }
                    />
                  )}
                  <img
                    src={participant.user.picture as string}
                    className="w-10 h-10 rounded-full ml-2"
                  />
                  <div className="flex flex-col ml-3">
                    <Heading fontSize="base">
                      {participant.user.displayName}
                    </Heading>
                    <Heading
                      onClick={() =>
                        setShowUsername((showUsername) => !showUsername)
                      }
                      className="-mt-1 unselectable text-gray-400 cursor-pointer"
                      fontSize="small"
                    >
                      {showUsername && participant.user.username
                        ? '@' + participant.user.username
                        : participant.user.email}
                    </Heading>
                  </div>
                </div>

                {selected && (
                  <Select
                    isSearchable={false}
                    className="react-select-container flex-shrink-0 w-40"
                    options={options}
                    classNamePrefix="react-select"
                    value={{ label: selected.role, value: selected.role }}
                    defaultValue={{
                      label: Participant_Role_Enum_Enum.Assistant,
                      value: Participant_Role_Enum_Enum.Assistant,
                    }}
                    onChange={(event) => {
                      setParticipants(
                        participants.map((p) =>
                          p.id === participant.id
                            ? {
                                ...p,
                                role:
                                  event?.value ||
                                  Participant_Role_Enum_Enum.Assistant,
                              }
                            : p
                        )
                      )
                    }}
                  />
                )}
              </div>
            )
          })}
      </div>

      <div className="flex items-center justify-between mt-8">
        <div>
          <Button
            appearance="link"
            icon={BiArrowBack}
            onClick={() => handlePrevious(participants)}
            type="button"
          >
            Previous
          </Button>
        </div>
        <div className="flex items-center">
          <Button
            appearance="primary"
            type="button"
            icon={BiRightArrowAlt}
            iconPosition="right"
            onClick={() => handleNext(participants)}
            loading={loading}
          >
            {participants.length > 0 ? 'Create' : 'Skip & Create'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default Participants
