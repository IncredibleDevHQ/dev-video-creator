/* eslint-disable jsx-a11y/label-has-associated-control */
import React, { useEffect, useState } from 'react'
import { useHistory, useParams } from 'react-router-dom'
import {
  Button,
  emitToast,
  Heading,
  Text,
  TextArea,
  TextField,
} from '../../components'
import {
  CreateFlickFlickScopeEnumEnum,
  CreateNewFlickMutationVariables,
  useCreateNewFlickMutation,
} from '../../generated/graphql'
import { useQuery } from '../../hooks'

export interface FlickConfiguration {
  themeId: number
}

const initialFlick: CreateNewFlickMutationVariables = {
  name: '',
  description: '',
  scope: CreateFlickFlickScopeEnumEnum.Public,
  configuration: {
    themeId: 0,
  } as FlickConfiguration,
}

const NewFlick = () => {
  const { seriesId } = useParams<{ seriesId: string }>()

  const [newFlick, setNewFlick] =
    useState<CreateNewFlickMutationVariables>(initialFlick)
  const [createNewFlick, { data, error, loading }] = useCreateNewFlickMutation()
  const history = useHistory()

  const query = useQuery()

  useEffect(() => {
    if (!seriesId) return

    setNewFlick({ ...newFlick, seriesId })
  }, [seriesId])

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
    value: string | FlickConfiguration
  ) => {
    setNewFlick({ ...newFlick, [field]: value })
  }

  const createFlick = async () => {
    if (newFlick.name) await createNewFlick({ variables: newFlick })
  }

  return (
    <section className="w-full min-h-screen flex flex-col justify-center items-center">
      <Heading fontSize="large" className="text-2xl mb-12">
        {query.get('seriesid')
          ? `Create Flick for "${query.get('seriesname')}"`
          : 'Create an incredible flick'}
      </Heading>
      <form className="w-96 p-4 flex flex-col">
        <Text className="font-semibold mb-1">Name your flick</Text>
        <TextField
          label=""
          className="mb-8"
          placeholder="Name"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            updateFlick('name', e.target.value)
          }
        />
        <Text className="font-semibold mb-1">Description</Text>
        <TextArea
          label=""
          className="mb-8"
          placeholder="Description"
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
            updateFlick('description', e.target.value)
          }
        />
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
          Continue
        </Button>
      </form>
    </section>
  )
}

export default NewFlick
