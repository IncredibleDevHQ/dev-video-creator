/* eslint-disable jsx-a11y/label-has-associated-control */
import React, { useEffect, useState } from 'react'
import { useHistory } from 'react-router-dom'
import {
  Button,
  emitToast,
  Heading,
  TextArea,
  TextField,
} from '../../components'
import {
  CreateFlickFlickScopeEnumEnum,
  CreateNewFlickMutationVariables,
  useCreateNewFlickMutation,
} from '../../generated/graphql'

const initialFlick: CreateNewFlickMutationVariables = {
  name: '',
  description: '',
  scope: CreateFlickFlickScopeEnumEnum.Private,
}

const NewFlick = () => {
  const [newFlick, setNewFlick] =
    useState<CreateNewFlickMutationVariables>(initialFlick)
  const [createNewFlick, { data, error, loading }] = useCreateNewFlickMutation()
  const history = useHistory()

  useEffect(() => {
    if (!error) return
    emitToast({
      title: "We couldn't create the flick for you",
      type: 'error',
      description: `Click this toast to refresh and give it another try.`,
      onClick: () => window.location.reload(),
    })
  }, [error])

  useEffect(() => {
    if (!data?.CreateFlick) return
    history.push(`/flick/${data.CreateFlick.id}`)
  }, [data])

  const updateFlick = (
    field: keyof CreateNewFlickMutationVariables,
    value: string
  ) => {
    setNewFlick({ ...newFlick, [field]: value })
  }

  const createFlick = async () => {
    if (newFlick.name) await createNewFlick({ variables: newFlick })
  }

  return (
    <section className="w-full min-h-screen flex flex-col justify-center items-center">
      <Heading fontSize="large" className="text-5xl mb-12">
        Create Your New Flick
      </Heading>
      <form className="shadow-md bg-background-alt w-full md:w-80 p-4 flex flex-col">
        <TextField
          label="Title"
          className="my-2"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            updateFlick('name', e.target.value)
          }
        />
        <TextArea
          label="Description"
          className="my-2"
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
            updateFlick('description', e.target.value)
          }
        />
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              updateFlick(
                'scope',
                e.target.checked
                  ? CreateFlickFlickScopeEnumEnum.Public
                  : CreateFlickFlickScopeEnumEnum.Private
              )
            }
          />
          <label>Public</label>
        </div>
        <Button
          loading={loading}
          type="submit"
          appearance="primary"
          className="my-2"
          onClick={(e) => {
            e?.preventDefault()
            createFlick()
          }}
        >
          Create
        </Button>
      </form>
    </section>
  )
}

export default NewFlick
