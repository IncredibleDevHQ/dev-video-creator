import React, { useEffect, useState } from 'react'
import { useRecoilState, useRecoilValue } from 'recoil'
import Gravatar from 'react-gravatar'
import { FiTrash2 } from 'react-icons/fi'
import { Button, Text, TextArea } from '../../../components'
import {
  Note_Insert_Input,
  useAddNoteMutation,
  useDeleteNoteMutation,
  useGetFragmentNotesQuery,
} from '../../../generated/graphql'
import { formatDate } from '../../../utils/FormatDate'
import { User, userState } from '../../../stores/user.store'
import { currentFlickStore } from '../../../stores/flick.store'

// This component renders notes for the current selected fragment in the flick dashboard
const Notes = ({
  fragmentId,
  flickId,
  participantId,
}: {
  fragmentId: string
  flickId: string
  participantId: string
}) => {
  const { sub } = (useRecoilValue(userState) as User) || {}
  const [flick, setFlick] = useRecoilState(currentFlickStore)
  // local state to store the newly created note
  const [note, setNote] = useState<Note_Insert_Input>({
    fragmentId,
    flickId,
    participantId,
    sourceUrl: 'Web',
    note: '',
  })

  const { data, refetch } = useGetFragmentNotesQuery({
    variables: {
      fragmentId,
    },
  })

  const [addNotesMutation, { data: successData, loading: addNoteLoading }] =
    useAddNoteMutation()

  const [deleteNotesMutation] = useDeleteNoteMutation()

  const addNote = async () => {
    // Return function if local note state doesn't exists
    // Add notes with addNotesMutation otherwise
    // Refetch only the notes data without having to refetch the entire flick or fragment
    if (!note.note || note.note.length < 1) return
    await addNotesMutation({ variables: { note } })
    await refetch()
  }

  const deleteNote = async (id: string) => {
    // Return function if note with id is not found
    // delete the note with deleteNotesMutation otherwise
    // Refetch only the notes data without having to refetch the entire flick or fragment
    if (!data?.Note.find((note) => note.id === id)) return
    await deleteNotesMutation({ variables: { id } })
    await refetch()
  }

  useEffect(() => {
    // This will clear the local note again after a successfull mutation
    if (successData?.insert_Note_one?.id) {
      setNote({
        ...note,
        note: '',
      })
    }
  }, [successData])

  return (
    <div>
      {data && data.Note.length > 0 ? (
        data.Note.map((n) => (
          <div
            className="mb-2 bg-white rounded-md p-2 overflow-x-hidden relative"
            key={n.id}
          >
            {n.participant?.userSub === sub && (
              <FiTrash2
                className="absolute right-1 top-1 text-error cursor-pointer bg-white"
                onClick={() => deleteNote(n.id)}
              />
            )}
            <div className=" flex flex-row justify-start items-start mb-2">
              {n?.participant?.user.picture ? (
                <img
                  src={n.participant.user.picture}
                  alt={n.participant.user.displayName || 'user'}
                  className="w-6 h-6 rounded-md"
                />
              ) : (
                <Gravatar
                  className="w-6 h-6 rounded-md"
                  email={n?.participant?.user.picture as string}
                />
              )}
              <Text fontSize="small" className="ml-2">
                {n.note}
              </Text>
            </div>
            <Text fontSize="small">{formatDate(new Date(n.createdAt))}</Text>
            <div className="flex flex-row justify-between items-center">
              <Text fontSize="small">{n.sourceUrl}</Text>
              <Text fontSize="small">Saved</Text>
            </div>
          </div>
        ))
      ) : (
        <Text>No notes to show</Text>
      )}
      <TextArea
        className="mt-8 mb-2"
        value={note.note || ''}
        label="Add notes"
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
          setNote({ ...note, note: e.target.value })
        }
      />

      <Button
        type="button"
        appearance="primary"
        size="extraSmall"
        onClick={addNote}
        disabled={flick?.fragments.length === 0}
      >
        {addNoteLoading ? 'Adding...' : 'Add'}
      </Button>
    </div>
  )
}

export default Notes
