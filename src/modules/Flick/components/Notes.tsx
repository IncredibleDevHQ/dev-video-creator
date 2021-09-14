import React, { useState } from 'react'
import Gravatar from 'react-gravatar'
import { limit } from 'react-laag/dist/util'
import Modal from 'react-responsive-modal'
import { Heading, Text } from '../../../components'
import { useGetFlickNotesQuery } from '../../../generated/graphql'

const Notes = ({ flickId }: { flickId: string }) => {
  const [showMoreText, setShowMoreText] = useState<{
    openModal: boolean
    text: string
  }>({ openModal: false, text: '' })
  const { data, loading } = useGetFlickNotesQuery({
    variables: {
      flickId: 'c92623d0-7894-4c4e-bf51-589fae64d163', // value for 'flickId'
    },
  })
  return loading ? (
    <Text className="text-center text-xs"> loading...</Text>
  ) : (
    <div>
      {data &&
        data.Note.length > 0 &&
        data.Note.map((note) => (
          <div className="mb-5">
            <div className=" flex flex-row gap-4 mb-2">
              {note.participant.user.picture ? (
                <img
                  src={note.participant.user.picture}
                  alt={note.participant.user.displayName || 'user'}
                  className="w-6 h-6 rounded-md"
                />
              ) : (
                <Gravatar
                  className="w-6 h-6 rounded-md"
                  email={note.participant.user.picture as string}
                />
              )}
              <Heading
                onClick={() => window.open(note.sourceUrl || undefined)}
                className="text-xl  cursor-pointer text-indigo-800"
              >
                {note.sourceUrl}
              </Heading>
            </div>
            {note.note.split('\n', 3).map((str) => (
              <div>
                <Text
                  className="truncate cursor-pointer whitespace-nowrap  overflow-hidden line-clamp-3 "
                  key={note.id}
                  onClick={() => {
                    setShowMoreText({
                      openModal: true,
                      text: note.note,
                    })
                  }}
                >
                  {str}
                </Text>
              </div>
            ))}
            <Modal
              classNames={{
                modal: 'w-full ',
                closeButton: 'focus:outline-none',
              }}
              open={showMoreText.openModal}
              onClose={() =>
                setShowMoreText({ openModal: false, text: showMoreText.text })
              }
              center
            >
              {/* <Text
                className="truncate cursor-pointer whitespace-nowrap  overflow-hidden "
                key={note.id}
                onClick={() => {
                  setShowMoreText({
                    openModal: false,
                    text: showMoreText.text,
                  })
                }}
              >
                {showMoreText.text}
              </Text> */}
              {showMoreText.text.split('\n').map((str) => (
                <div>
                  <Text
                    className="flex "
                    key={note.id}
                    onClick={() => {
                      setShowMoreText({
                        openModal: false,
                        text: showMoreText.text,
                      })
                    }}
                  >
                    {str}
                  </Text>
                </div>
              ))}
            </Modal>
          </div>
        ))}
      {data && data.Note.length === 0 && (
        <div className="flex flex-col justify-center">
          <Text className="text-center text-xs">
            Oops you haven't Added any notes yet!
          </Text>
        </div>
      )}
    </div>
  )
}

export default Notes
