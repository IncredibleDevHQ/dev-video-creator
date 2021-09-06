import React, { useState } from 'react'
import { useHistory, useParams } from 'react-router-dom'
import { BiCog, BiGift, BiNotepad } from 'react-icons/bi'
import { BsArrowLeft } from 'react-icons/bs'
import {
  BaseFragment,
  Basics,
  Form,
  FormParticipant,
  Participants,
  Stepper,
} from './components'
import { emitToast, Heading, ScreenState } from '../../components'
import {
  CreateFragmentTypeEnum,
  Flick,
  useCreateFragmentMutation,
  useGetFlickByIdQuery,
  useInsertParticipantToFragmentMutation,
} from '../../generated/graphql'

const NewFragment = () => {
  const [active, setActive] = useState(0)
  const { goBack, push } = useHistory()

  const { id: flickId } = useParams<{ id: string }>()
  const { data, loading, called } = useGetFlickByIdQuery({
    variables: { id: flickId },
  })

  const [createFragmentLoading, setCreateFragmentLoading] = useState(false)

  const [createFragment] = useCreateFragmentMutation()
  const [insertParticipantToFragment] = useInsertParticipantToFragmentMutation()

  const [form, setForm] = useState<Form>({
    name: '',
    participants: [],
  })

  const handleCreate = async (form: Form) => {
    setCreateFragmentLoading(true)
    const description =
      (form.description?.trim().length || 0) > 0 ? form.description : undefined
    if (typeof form.type === 'undefined')
      throw Error('Fragment Type not defined.')

    try {
      const { data, errors } = await createFragment({
        variables: {
          flickId,
          description,
          type: form.type as unknown as CreateFragmentTypeEnum,
          name: form.name,
        },
      })

      if (errors) {
        throw Error(errors[0].message)
      }

      if (!data?.CreateFragment?.id) throw Error('Fragment ID not found.')

      if (form.participants.length > 0) {
        const promises: Promise<any>[] = []
        form.participants.forEach((participant) => {
          return insertParticipantToFragment({
            variables: {
              fragmentId: data.CreateFragment?.id,
              participantId: participant.id,
            },
          })
        })

        await Promise.all(promises)

        emitToast({
          type: 'success',
          title: "And that's how it is done!",
          description: `${form.name} was created. Do configure this ${form.type} to make it your own! :)`,
        })

        push(`/flick/${flickId}/${data.CreateFragment?.id}`)
      }
    } catch (e) {
      emitToast({
        type: 'error',
        title: 'Things went south.',
        description: (e as Error).message,
      })
      throw e
    } finally {
      setCreateFragmentLoading(false)
    }
  }

  if (loading) return <ScreenState title="Just a jiffy..." loading />

  if (!data?.Flick_by_pk && !loading && called)
    return <ScreenState title="That Flick is 404!" loading={false} />

  if (data?.Flick_by_pk?.participants.length === 0) {
    return (
      <ScreenState
        title="Uh, oh."
        subtitle="Looks like there are no participants in this Flick. Add some to start creating Fragments."
        loading={false}
      />
    )
  }

  return (
    <div className="flex-1 py-12 px-8 relative">
      <BsArrowLeft
        className="absolute cursor-pointer"
        size={36}
        onClick={() => {
          goBack()
        }}
      />

      <div className="flex flex-1 items-center flex-col">
        <Heading fontSize="large">Create a Fragment</Heading>
        <Heading fontSize="base" className="mt-3">
          {(() => {
            switch (active) {
              case 0:
                return "Let's start by picking a base"
              case 1:
                return `${form.type} it is. Now give it a name!`
              case 2:
                return `Who would you want to feature in this ${form.type}?`
              default:
                return ''
            }
          })()}
        </Heading>
        <Stepper
          className="mt-8"
          steps={[
            { label: 'Base Fragment', value: 'base', icon: BiNotepad },
            { label: 'Basics', value: 'basics', icon: BiCog },
            {
              label: 'Invite Participants',
              value: 'participants',
              icon: BiGift,
            },
          ]}
          active={active}
        />

        <div className="mt-8 w-full md:w-1/2">
          {active === 0 && (
            <BaseFragment
              handleNext={(value) => {
                setForm((form) => ({ ...form, type: value }))
                setActive(1)
              }}
            />
          )}

          {active === 1 && (
            <Basics
              handleNext={({ name, description }) => {
                setActive(2)
                setForm((form) => ({ ...form, name, description }))
              }}
              handlePrevious={({ name, description }) => {
                setForm((form) => ({ ...form, name, description }))
                setActive(0)
              }}
              form={form}
            />
          )}

          {active === 2 && (
            <Participants
              loading={createFragmentLoading}
              handleNext={(participants: FormParticipant[]) => {
                const tempForm = { ...form, participants }
                setForm(tempForm)
                handleCreate(tempForm)
              }}
              handlePrevious={(participants: FormParticipant[]) => {
                setForm((form) => ({ ...form, participants }))
                setActive(1)
              }}
              flick={data?.Flick_by_pk as Flick}
              form={form}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default NewFragment
