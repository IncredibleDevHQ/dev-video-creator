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
  useAddFragmentToFlickMutation,
  useGetFilteredUsersQuery,
} from '../../../generated/graphql'
import Select from 'react-select'
import { id } from 'date-fns/locale'

const FragmentType = ({
  fragment,
  setFragment,
  type,
}: {
  fragment: AddFragmentToFlickMutationVariables
  setFragment: (fragment: AddFragmentToFlickMutationVariables) => void
  type: Fragment_Type_Enum_Enum
}) => {
  switch (type) {
    case Fragment_Type_Enum_Enum.Splash:
      return (
        <div
          role="button"
          tabIndex={0}
          onKeyUp={() => {}}
          className={cx(
            'flex flex-col items-center p-2 rounded-md border-2 border-dotted mx-2 focus:outline-none',
            { 'border-brand': fragment.type === Fragment_Type_Enum_Enum.Splash }
          )}
          onClick={() =>
            setFragment({ ...fragment, type: Fragment_Type_Enum_Enum.Splash })
          }
        >
          <GiSplash
            size={30}
            className={cx('mb-2', {
              'text-brand': fragment.type === Fragment_Type_Enum_Enum.Splash,
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
    case Fragment_Type_Enum_Enum.CodeJam:
      return (
        <div
          role="button"
          tabIndex={0}
          onKeyUp={() => {}}
          className={cx(
            'flex flex-col items-center p-2 rounded-md border-2 border-dotted mx-2',
            {
              'border-brand': fragment.type === Fragment_Type_Enum_Enum.CodeJam,
            }
          )}
          onClick={() =>
            setFragment({ ...fragment, type: Fragment_Type_Enum_Enum.CodeJam })
          }
        >
          <FiCode
            size={30}
            className={cx('mb-2', {
              'text-brand': fragment.type === Fragment_Type_Enum_Enum.CodeJam,
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
    case Fragment_Type_Enum_Enum.Trivia:
      return (
        <div
          role="button"
          tabIndex={0}
          onKeyUp={() => {}}
          className={cx(
            'flex flex-col items-center p-2 rounded-md border-2 border-dotted mx-2',
            { 'border-brand': fragment.type === Fragment_Type_Enum_Enum.Trivia }
          )}
          onClick={() =>
            setFragment({ ...fragment, type: Fragment_Type_Enum_Enum.Trivia })
          }
        >
          <BsQuestionCircle
            size={30}
            className={cx('mb-2', {
              'text-brand': fragment.type === Fragment_Type_Enum_Enum.Trivia,
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
    case Fragment_Type_Enum_Enum.Videoshow:
      return (
        <div
          role="button"
          tabIndex={0}
          onKeyUp={() => {}}
          className={cx(
            'flex flex-col items-center p-2 rounded-md border-2 border-dotted mx-2',
            {
              'border-brand':
                fragment.type === Fragment_Type_Enum_Enum.Videoshow,
            }
          )}
          onClick={() =>
            setFragment({
              ...fragment,
              type: Fragment_Type_Enum_Enum.Videoshow,
            })
          }
        >
          <FiTv
            size={30}
            className={cx('mb-2', {
              'text-brand': fragment.type === Fragment_Type_Enum_Enum.Videoshow,
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

export interface options {
  value: string
  lable: string
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
  const [selectedMember, setSelectedMember] = useState<options[]>([])

  const [fragment, setFragment] = useState<AddFragmentToFlickMutationVariables>(
    {
      name: '',
      description: '',
      flickId,
      order: totalFragments,
      type: Fragment_Type_Enum_Enum.CodeJam,
    }
  )
  const [addFragment, { error, loading }] = useAddFragmentToFlickMutation()

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
    selectedMember.map((m) => {
      console.log('selectedMember', m.value)
    })

    await addFragment({ variables: fragment })
    handleClose(true)
  }
  const handleChange = (e: any) => {
    console.log('id', e, 'name', e)
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
        {Object.entries(Fragment_Type_Enum_Enum).map(([, type]) => (
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
        value={fragment.description}
        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
          updateFragment('description', e.target.value)
        }
        required
      />
      <Text>Creators</Text>
      <Select
        className="flex-1 mt-2"
        isMulti={true}
        noOptionsMessage={() => 'Search a Name..'}
        onChange={(value) => setSelectedMember(value as [])}
        options={participants.map((user: FlickParticipantsFragment) => {
          const option = {
            value: user.id,
            label: user.user.displayName as string,
          }
          return option
        })}
        placeholder="Search a Creator"
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
