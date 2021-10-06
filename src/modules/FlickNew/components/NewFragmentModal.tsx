import React, { HTMLProps, useEffect } from 'react'
import { BiUser } from 'react-icons/bi'
import { IoCloseOutline } from 'react-icons/io5'
import { useRecoilState } from 'recoil'
import { emitToast, Heading, Text } from '../../../components'
import { fragmentIcons } from '../../../constants'
import {
  CreateFragmentTypeEnum,
  Fragment_Type_Enum_Enum,
  useCreateFragmentMutation,
} from '../../../generated/graphql'
import { newFlickStore } from '../store/flickNew.store'

export const fragmentTypes = [
  {
    label: 'Splash',
    image: fragmentIcons.splash,
    description: 'Create incredible intros and outros',
    value: Fragment_Type_Enum_Enum.Splash,
    accessory: '1 person',
  },
  {
    label: 'CodeJam',
    image: fragmentIcons.codeJam,
    description: 'Talk over your code snippets',
    value: Fragment_Type_Enum_Enum.CodeJam,
    accessory: '1-2 Person',
  },
  {
    label: 'VideoJam',
    image: fragmentIcons.videoJam,
    description: 'Talk over your videos',
    value: Fragment_Type_Enum_Enum.Videoshow,
    accessory: '1-2 people',
  },
  {
    label: 'Trivia',
    image: fragmentIcons.trivia,
    description: 'Talk over your points',
    value: Fragment_Type_Enum_Enum.Trivia,
    accessory: '1 person',
  },
  {
    label: 'Presenter',
    image: fragmentIcons.slides,
    description: 'Present texts and pictures',
    value: Fragment_Type_Enum_Enum.Slides,
    accessory: '1 person',
  },
  {
    label: 'Points',
    image: fragmentIcons.points,
    description: 'Talk solo or have discussions',
    value: Fragment_Type_Enum_Enum.Points,
    accessory: '1 person',
  },
]

const NewFragmentModal = ({
  handleClose,
}: {
  handleClose: (refresh?: boolean) => void
}) => {
  const [{ flick }, setFlick] = useRecoilState(newFlickStore)
  const [createFragment, { data, error }] = useCreateFragmentMutation()

  useEffect(() => {
    if (!data) return
    setFlick((store) => ({
      ...store,
      activeFragmentId: data.CreateFragment?.id,
    }))
    handleClose(true)
  }, [data])

  useEffect(() => {
    if (!error) return
    emitToast({
      type: 'error',
      title: 'Could not create your fragment',
      description: 'Please try again',
    })
  }, [error])

  return (
    <div className="bg-gray-50 flex flex-col justify-center items-center absolute left-0 top-0 h-full w-full">
      <IoCloseOutline
        className="absolute right-5 top-5 cursor-pointer"
        size={32}
        onClick={() => {
          handleClose()
        }}
      />
      <div className="w-3/4">
        <Heading fontSize="large" className="text-2xl mb-12">
          Choose a fragment
        </Heading>
        <div className="grid grid-cols-3 grid-flow-row gap-8 items-center justify-center">
          {fragmentTypes.map(
            ({ label, image, description, value, accessory }) => (
              <div
                onClick={() => {
                  createFragment({
                    variables: {
                      flickId: flick?.id,
                      name: label,
                      type: CreateFragmentTypeEnum[value],
                      description: description,
                    },
                  })
                }}
                className="flex cursor-pointer flex-col p-6 rounded-xl bg-white shadow-sm transition-all transform hover:-translate-y-2 hover:shadow-md"
              >
                <Heading
                  className="self-end lowercase flex items-center py-1 px-2 rounded-md text-gray-600 bg-gray-50"
                  fontSize="extra-small"
                >
                  <BiUser className="mr-1" />
                  {accessory}
                </Heading>
                <img className="w-min h-10 mt-2" src={image} alt={label} />
                <Text className="mt-8 mb-2 font-semibold">{label}</Text>
                <Text>{description}</Text>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}

export default NewFragmentModal
