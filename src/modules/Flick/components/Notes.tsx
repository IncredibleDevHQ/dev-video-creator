import React from 'react'
import { Heading, Text } from '../../../components'
import { useGetFlickNotesQuery } from '../../../generated/graphql'

const Notes = ({ flickId }: { flickId: string }) => {
  const { data, loading } = useGetFlickNotesQuery({
    variables: {
      flickId, // value for 'flickId'
    },
  })
  return loading ? (
    <Text className="text-center text-xs"> loading...</Text>
  ) : (
    <div>
      {data &&
        data.Note.length > 0 &&
        data.Note.map((note) => (
          <div className="mb-3">
            <Heading
              onClick={() => window.open(note.sourceUrl || undefined)}
              className="text-xl text-indigo-800"
            >
              {note.sourceUrl}
            </Heading>
            <Text className="h-20 text-sm overflow-hidden overflow-ellipsis">
              {note.note}
            </Text>
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
