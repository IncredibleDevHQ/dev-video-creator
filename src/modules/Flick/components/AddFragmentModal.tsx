import { cx } from '@emotion/css'
import React, { useEffect, useState } from 'react'
import Modal from 'react-responsive-modal'
import { GiSplash } from 'react-icons/gi'
import { FiCode, FiTv } from 'react-icons/fi'
import { BsQuestionCircle } from 'react-icons/bs'
import {
  Button,
  emitToast,
  Heading,
  Text,
  TextArea,
  TextField,
} from '../../../components'
import {
  AddFragmentToFlickMutationVariables,
  FilteredUserFragment,
  FlickParticipantsFragment,
  Fragment_Type_Enum_Enum,
  CreateFragmentMutationVariables,
  useCreateFragmentMutation,
  useGetFilteredUsersQuery,
  CreateFragmentTypeEnum,
} from '../../../generated/graphql'

const FragmentType = ({
  fragment,
  setFragment,
  type,
}: {
  fragment: CreateFragmentMutationVariables
  setFragment: (fragment: CreateFragmentMutationVariables) => void
  type: CreateFragmentTypeEnum
}) => {
  switch (type) {
    case CreateFragmentTypeEnum.Splash:
      return (
        <div
          role="button"
          tabIndex={0}
          onKeyUp={() => {}}
          className={cx(
            'flex flex-col items-center p-2 rounded-md border-2 border-dotted mx-2 focus:outline-none',
            { 'border-brand': fragment.type === CreateFragmentTypeEnum.Splash }
          )}
          onClick={() =>
            setFragment({ ...fragment, type: CreateFragmentTypeEnum.Splash })
          }
        >
          <GiSplash
            size={30}
            className={cx('mb-2', {
              'text-brand': fragment.type === CreateFragmentTypeEnum.Splash,
            })}
          />
          <Heading fontSize="base" className="font-semibold">
            Splash
          </Heading>
          <Text fontSize="small" className="text-xs text-center">
            This is a perfect Fragment for creating Intro Videos
          </Text>
        </div>
      )
    case CreateFragmentTypeEnum.CodeJam:
      return (
        <div
          role="button"
          tabIndex={0}
          onKeyUp={() => {}}
          className={cx(
            'flex flex-col items-center p-2 rounded-md border-2 border-dotted mx-2',
            {
              'border-brand': fragment.type === CreateFragmentTypeEnum.CodeJam,
            }
          )}
          onClick={() =>
            setFragment({ ...fragment, type: CreateFragmentTypeEnum.CodeJam })
          }
        >
          <FiCode
            size={30}
            className={cx('mb-2', {
              'text-brand': fragment.type === CreateFragmentTypeEnum.CodeJam,
            })}
          />
          <Heading fontSize="base" className="font-semibold">
            CodeJam
          </Heading>
          <Text fontSize="small" className="text-xs text-center">
            This is a perfect Fragment for creating Intro Videos
          </Text>
        </div>
      )
    case CreateFragmentTypeEnum.Trivia:
      return (
        <div
          role="button"
          tabIndex={0}
          onKeyUp={() => {}}
          className={cx(
            'flex flex-col items-center p-2 rounded-md border-2 border-dotted mx-2',
            { 'border-brand': fragment.type === CreateFragmentTypeEnum.Trivia }
          )}
          onClick={() =>
            setFragment({ ...fragment, type: CreateFragmentTypeEnum.Trivia })
          }
        >
          <BsQuestionCircle
            size={30}
            className={cx('mb-2', {
              'text-brand': fragment.type === CreateFragmentTypeEnum.Trivia,
            })}
          />
          <Heading fontSize="base" className="font-semibold">
            Trivia
          </Heading>
          <Text fontSize="small" className="text-xs text-center">
            This is a perfect Fragment for creating Intro Videos
          </Text>
        </div>
      )
    case CreateFragmentTypeEnum.Videoshow:
      return (
        <div
          role="button"
          tabIndex={0}
          onKeyUp={() => {}}
          className={cx(
            'flex flex-col items-center p-2 rounded-md border-2 border-dotted mx-2',
            {
              'border-brand':
                fragment.type === CreateFragmentTypeEnum.Videoshow,
            }
          )}
          onClick={() =>
            setFragment({
              ...fragment,
              type: CreateFragmentTypeEnum.Videoshow,
            })
          }
        >
          <FiTv
            size={30}
            className={cx('mb-2', {
              'text-brand': fragment.type === CreateFragmentTypeEnum.Videoshow,
            })}
          />
          <Heading fontSize="base" className="font-semibold">
            Videoshow
          </Heading>
          <Text fontSize="small" className="text-xs text-center">
            This is a perfect Fragment for creating Intro Videos
          </Text>
        </div>
      )
    default:
      return null
  }
}

const AddFragmentModal = ({
  open,
  flickId,
  totalFragments,
  handleClose,
  participants,
}: {
  open: boolean
  flickId: string
  totalFragments: number
  handleClose: (refresh?: boolean) => void
  participants: FlickParticipantsFragment[]
}) => {
  const [fragment, setFragment] = useState<CreateFragmentMutationVariables>({
    name: '',
    description: '',
    flickId,
    type: CreateFragmentTypeEnum.CodeJam,
  })
  const [addFragment, { error, loading }] = useCreateFragmentMutation()

  useEffect(() => {
    if (!error) return
    emitToast({
      title: "We couldn't create add the fragment",
      type: 'error',
      description: `${error.message}. Click this toast to refresh and give it another try.`,
      onClick: () => window.location.reload(),
    })
  }, [error])

  const updateFragment = (
    field: keyof Pick<
      AddFragmentToFlickMutationVariables,
      'name' | 'description'
    >,
    value: string
  ) => {
    setFragment({ ...fragment, [field]: value })
  }

  const onSubmit = async () => {
    await addFragment({ variables: fragment })
    handleClose(true)
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        handleClose()
      }}
      classNames={{
        modal: cx('rounded-lg w-full md:w-1/2'),
      }}
      center
    >
      <Heading fontSize="medium">Add new Fragment</Heading>
      <div className="flex flex-row justify-evenly items-center my-4">
        {Object.entries(CreateFragmentTypeEnum).map(([, type]) => (
          <FragmentType
            key={type}
            fragment={fragment}
            setFragment={setFragment}
            type={type}
          />
        ))}
      </div>
      <TextField
        label="Title"
        value={fragment.name}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          updateFragment('name', e.target.value)
        }
        required
      />
      <TextArea
        label="Description"
        value={fragment.description as string}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
          updateFragment('description', e.target.value)
        }
        required
      />

      <Button
        appearance="primary"
        type="button"
        size="small"
        className="my-2 ml-auto"
        loading={loading}
        onClick={onSubmit}
      >
        Create
      </Button>
    </Modal>
  )
}

export default AddFragmentModal
