import React, { useState } from 'react'
import { useRecoilValue } from 'recoil'
import { css, cx } from '@emotion/css'
import Modal from 'react-responsive-modal'
import Gravatar from 'react-gravatar'
import {
  NoteFragment,
  Note_Insert_Input,
  useAddNoteMutation,
  useGetFragmentNotesQuery,
  useGetSuggestedTextMutation,
  useUpdateNoteMutation,
} from '../../../generated/graphql'
import {
  ScreenState,
  Text,
  Heading,
  TextField,
  Button,
  TextArea,
} from '../../../components'
import { formatDate } from '../../../utils/FormatDate'
import { User, userState } from '../../../stores/user.store'

const Note = ({
  note,
  participantId,
  editNote,
}: {
  participantId: string
  note: NoteFragment
  editNote: (id: string, text: string) => Promise<void>
}) => {
  const [activeNote, setActiveNote] = useState<string>(note.note)
  const { sub } = (useRecoilValue(userState) as User) || {}

  return (
    <div className="mb-2 bg-gray-50 rounded-md p-2 overflow-x-hidden max-h-80 overflow-y-auto">
      <div className=" flex flex-row justify-start items-start mb-1">
        {note?.participant?.user.picture ? (
          <img
            src={note.participant.user.picture}
            alt={note.participant.user.displayName || 'user'}
            className="w-6 h-6 rounded-md"
          />
        ) : (
          <Gravatar
            className="w-6 h-6 rounded-md"
            email={note?.participant?.user.picture as string}
          />
        )}
        <TextField
          label=""
          className="ml-2 w-full"
          contentEditable={note.participant?.userSub === sub}
          value={activeNote}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            if (note.participant?.id === participantId)
              setActiveNote(e.target.value)
          }}
          onFocus={() => setActiveNote(note.note)}
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.ctrlKey && e.key === 'Space') {
              e.stopPropagation()
              editNote(note.id, activeNote)
            }
          }}
        />
      </div>
      {note.note !== activeNote && (
        <Button
          type="button"
          appearance="primary"
          size="extraSmall"
          className="ml-auto"
          onClick={() => editNote(note.id, activeNote)}
        >
          Save
        </Button>
      )}
      <div className="flex flex-row justify-between items-center">
        <Text fontSize="small">{note.sourceUrl}</Text>
        <Text fontSize="small">{formatDate(new Date(note.createdAt))}</Text>
      </div>
    </div>
  )
}

const PresenterNotes = ({
  open,
  flickId,
  fragmentId,
  participantId,
  handleClose,
}: {
  open: boolean
  flickId: string
  fragmentId: string
  participantId: string
  handleClose: () => void
}) => {
  const [showSuggestedText, setShowSuggestedText] = useState<boolean>(false)
  const [newNote, setNewNote] = useState<Note_Insert_Input>({
    flickId,
    fragmentId,
    participantId,
    sourceUrl: 'Web',
    note: '',
  })

  const { data, refetch } = useGetFragmentNotesQuery({
    variables: {
      fragmentId,
    },
  })

  const [addNotesMutation, { loading: addNoteLoading }] = useAddNoteMutation()
  const [getSuggestedText, { data: suggestedTextData }] =
    useGetSuggestedTextMutation()
  const [updateNotesMutation] = useUpdateNoteMutation()

  const addNote = async () => {
    if (!newNote.note || newNote.note.length < 1) return
    await addNotesMutation({ variables: { note: newNote } })
    setNewNote({ ...newNote, note: '' })
    await refetch()
  }

  const editNote = async (id: string, newText: string) => {
    await updateNotesMutation({
      variables: { id, note: newText },
    })
    await refetch()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      center
      classNames={{
        modal: cx(
          'rounded-lg w-auto md:w-1/2',
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
      <div>
        {(() => {
          if (!data?.Note || data?.Note.length < 1) {
            return <ScreenState title="No notes here" />
          }
          return (
            <div>
              <Heading
                fontSize="medium"
                tabIndex={0}
                className="focus:outline-none mb-4"
              >
                Notes
              </Heading>
              <div>
                {data.Note.map((n) => (
                  <Note
                    note={n}
                    participantId={participantId}
                    editNote={editNote}
                    key={n.id}
                  />
                ))}
                {showSuggestedText ? (
                  // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
                  <p
                    onKeyDown={(
                      e: React.KeyboardEvent<HTMLParagraphElement>
                    ) => {
                      e.stopPropagation()
                      if (e.ctrlKey) {
                        setShowSuggestedText(false)
                      }
                    }}
                    contentEditable
                  >
                    {newNote.note}
                    <span className="text-gray-600">
                      {suggestedTextData?.SuggestPhrase?.suggestion}
                    </span>
                  </p>
                ) : (
                  <TextArea
                    label="Add Note"
                    value={newNote.note || ''}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setNewNote({ ...newNote, note: e.target.value })
                    }
                    onKeyDown={async (
                      e: React.KeyboardEvent<HTMLTextAreaElement>
                    ) => {
                      if (e.ctrlKey) {
                        await getSuggestedText({
                          variables: { text: newNote.note || '' },
                        })
                        setShowSuggestedText(true)
                      }
                    }}
                  />
                )}
                <Button
                  type="button"
                  className="my-2"
                  appearance="primary"
                  size="extraSmall"
                  onClick={addNote}
                >
                  {addNoteLoading ? 'Saving...' : 'Add Note'}
                </Button>
              </div>
            </div>
          )
        })()}
      </div>
    </Modal>
  )
}

export default PresenterNotes
