import React, { useContext } from 'react'
import { MdCheckBox, MdCheckBoxOutlineBlank } from 'react-icons/md'
import { Heading, Text } from '../../../../components'
import { PublishContext } from './PublishFlick'

const Permissions = () => {
  const { isOpenForCollaboration, setIsOpenForCollaboration } =
    useContext(PublishContext)

  return (
    <div>
      <div className="my-4 text-gray-600">
        <Heading fontSize="small" className="font-semibold text-gray-800">
          Collaborations
        </Heading>
        <Text fontSize="small">
          If you’re open to collaborations in this content, we’ll allow viewers
          to send collaboration requests to you for formats you have not
          published yet.
        </Text>
        <div className="flex items-center">
          {isOpenForCollaboration ? (
            <MdCheckBox
              size={24}
              className="text-brand"
              onClick={() => setIsOpenForCollaboration(false)}
            />
          ) : (
            <MdCheckBoxOutlineBlank
              size={24}
              onClick={() => setIsOpenForCollaboration(true)}
            />
          )}
          <Text>I&apos;m open to collaboration</Text>
        </div>
      </div>
      <div className="my-4 opacity-60 cursor-not-allowed">
        <Heading fontSize="small" className="font-semibold text-gray-800">
          Remixes{' '}
          <span className="bg-gray-300 px-1 py-0.5 rounded-sm font-thin text-gray-600 uppercase text-xs">
            Coming Soon
          </span>
        </Heading>
        <Text fontSize="small">
          If you enable remix feature for this content, viewers use your
          fragments and create a video of their own.
        </Text>
        <div className="flex items-center">
          <MdCheckBoxOutlineBlank
            size={24}
            onClick={() => setIsOpenForCollaboration(true)}
          />
          <Text>Allow remixes</Text>
        </div>
      </div>
    </div>
  )
}

export default Permissions
