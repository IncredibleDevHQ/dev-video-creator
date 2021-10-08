import { css, cx } from '@emotion/css'
import React, {
  ChangeEvent,
  HTMLAttributes,
  useCallback,
  useEffect,
  useState,
} from 'react'
import { Modal } from 'react-responsive-modal'
import { useRecoilState } from 'recoil'
import {
  Button,
  emitToast,
  Heading,
  Label,
  TextArea,
  TextField,
} from '../../../components'
import {
  CreateFragmentTypeEnum,
  Fragment_Type_Enum_Enum,
  useCreateFragmentMutation,
  useInsertParticipantToFragmentMutation,
} from '../../../generated/graphql'
import { newFlickStore } from '../store/flickNew.store'
import { fragmentTypes } from './NewFragmentModal'

const Pill = ({
  className,
  active,
  ...rest
}: HTMLAttributes<HTMLLIElement> & { active?: boolean }) => {
  return (
    <li
      className={cx(
        'py-1.5 px-4 cursor-pointer transition-colors rounded-md border-brand border border-transparent',
        {
          'bg-brand-10': active,
        },
        className
      )}
      {...rest}
    />
  )
}

const DuplicateFragmentModal = ({
  open,
  handleClose,
}: {
  open: boolean
  handleClose: (refresh?: boolean) => void
}) => {
  const [{ flick, activeFragmentId }, setFlickStore] =
    useRecoilState(newFlickStore)

  const DEFAULT_VALUES = {
    title: '',
    description: '',
    participants:
      flick?.fragments
        .find((f) => f.id === activeFragmentId)
        ?.participants.map((p) => p.participant.id as string) || [],
    type: flick?.fragments.find((f) => f.id === activeFragmentId)?.type,
  }

  const [candidate, setCandidate] = useState<{
    title?: string
    description?: string
    participants?: string[]
    type?: Fragment_Type_Enum_Enum
  }>(DEFAULT_VALUES)

  const [loading, setLoading] = useState(false)
  const [insertParticipantToFragment] = useInsertParticipantToFragmentMutation()
  const [createFragment] = useCreateFragmentMutation()

  useEffect(() => {
    const defaultFragmentConfig = {
      title: '',
      description: '',
      participants:
        flick?.fragments
          .find((f) => f.id === activeFragmentId)
          ?.participants.map((p) => p.participant.id as string) || [],
      type: flick?.fragments.find((f) => f.id === activeFragmentId)?.type,
    }
    setCandidate(defaultFragmentConfig)
  }, [activeFragmentId])

  const handleDuplicate = async () => {
    setLoading(true)

    const description =
      (candidate?.description?.trim().length || 0) > 0
        ? candidate?.description
        : undefined

    try {
      const { data, errors } = await createFragment({
        variables: {
          flickId: flick?.id,
          description,
          type: candidate?.type as unknown as CreateFragmentTypeEnum,
          name: candidate?.title as string,
        },
      })

      if (errors) {
        throw Error(errors[0].message)
      }

      if (!data?.CreateFragment?.id) throw Error('Fragment ID not found.')

      if (candidate?.participants && candidate?.participants?.length > 0) {
        const promises = candidate.participants.map((participantId) => {
          return insertParticipantToFragment({
            variables: {
              fragmentId: data.CreateFragment?.id,
              participantId,
            },
          })
        })

        await Promise.all(promises)

        emitToast({
          type: 'success',
          title: "And that's how it is done!",
          description: `${candidate.title} was created. Do configure this ${candidate.type} to make it your own! :)`,
        })

        setFlickStore((prev) => ({
          ...prev,
          activeFragmentId: data.CreateFragment?.id,
        }))

        handleClose(true)
      }
    } catch (e) {
      emitToast({
        type: 'error',
        title: 'Things went south.',
        description: (e as Error).message,
      })
      throw e
    } finally {
      setLoading(false)
    }
  }

  const validateCandidate = useCallback(() => {
    if (!candidate) return false
    if (!candidate.title || candidate.title.length <= 0) return false
    if ((candidate.participants || []).length <= 0) return false
    if (!candidate.type) return false
    return true
  }, [candidate])

  return (
    <Modal
      open={open}
      onClose={() => {
        handleClose()
      }}
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
        <div className="mx-4 my-2">
          <div className="flex items-center justify-between">
            <Heading fontSize="medium">Duplicate Fragment</Heading>
          </div>
          <Heading fontSize="small" className="mt-1 mb-4">
            Your fragment{' '}
            <b>
              {
                flick?.fragments.find((f) => f.flickId === activeFragmentId)
                  ?.name
              }
            </b>{' '}
            will be duplicated with various existing settings. You have the
            option to tailor them before duplication.
          </Heading>

          <TextField
            label="Title"
            required
            placeholder="A Peak into Segmented Stacks"
            value={candidate?.title}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setCandidate({ ...candidate, title: e.target.value })
            }
            tabIndex={0}
          />
          <TextArea
            className="mt-4"
            rows={3}
            label="Description"
            placeholder="The goal of this Fragment is to demonstrate and explain segmented stacks at compile time."
            value={candidate?.description}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
              setCandidate({ ...candidate, description: e.target.value })
            }
            tabIndex={0}
          />

          <div className="my-2">
            <Label>Type</Label>
            <ul className="flex flex-wrap gap-4">
              {fragmentTypes.map((fragmentType) => (
                <Pill
                  className="flex items-center"
                  active={candidate?.type === fragmentType.value}
                  key={fragmentType.value}
                  onClick={() => {
                    setCandidate({ ...candidate, type: fragmentType.value })
                  }}
                >
                  <img
                    className="h-4 mr-2"
                    src={fragmentType.image}
                    alt={fragmentType.value}
                  />
                  {fragmentType.label}
                </Pill>
              ))}
            </ul>
          </div>

          <div className="py-2">
            <Label>Participants</Label>
            <ul className="flex flex-wrap gap-4">
              {flick?.participants?.map((participant) => (
                <Pill
                  className="flex items-center"
                  key={participant.id}
                  active={
                    candidate?.participants?.find(
                      (id) => id === (participant.id as string)
                    ) !== undefined
                  }
                  onClick={() => {
                    if (
                      candidate?.participants?.find(
                        (id) => id === (participant.id as string)
                      )
                    ) {
                      setCandidate({
                        ...candidate,
                        participants: candidate?.participants.filter(
                          (id) => id !== (participant.id as string)
                        ),
                      })
                    } else {
                      setCandidate({
                        ...candidate,
                        participants: [
                          ...(candidate?.participants || []),
                          participant.id as string,
                        ],
                      })
                    }
                  }}
                >
                  <img
                    className="w-6 mr-2 rounded-full"
                    src={participant.user.picture as string}
                    alt={participant.user.displayName as string}
                  />
                  {participant.user.displayName}
                </Pill>
              ))}
            </ul>
          </div>

          <div className="pt-4 flex items-center justify-end">
            <Button
              disabled={!validateCandidate()}
              appearance="primary"
              type="button"
              size="extraSmall"
              onClick={handleDuplicate}
              loading={loading}
            >
              Duplicate
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default DuplicateFragmentModal
