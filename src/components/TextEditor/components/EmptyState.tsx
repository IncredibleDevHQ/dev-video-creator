import { IconType, useChainedCommands } from '@remirror/react'
import React, { useCallback, useState } from 'react'
import { IoCode, IoImage, IoList, IoPlay } from 'react-icons/io5'
import { Heading, Text } from '../..'
import ImageModal from '../ImageModal'
import VideoModal from '../VideoModal'

export const BlockTab = ({
  label,
  icon: I,
  handleClick,
}: {
  label: string
  icon: IconType
  handleClick?: () => void
}) => {
  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      onClick={handleClick}
      className="flex flex-col justify-center bg-gray-100 rounded-md px-2 py-3 items-center"
    >
      <I />
      <span className="mt-2">{label}</span>
    </div>
  )
}

const EmptyState = () => {
  const chain = useChainedCommands()

  // TODO: Scope for improvement...
  const tabs = useCallback(() => {
    return [
      {
        label: 'Code',
        icon: IoCode,
        main: true,
        name: 'codeBlock',
        handleClick: () => {
          chain
            .toggleSlab()
            .createCodeBlock({ code: '', layout: 'code', language: 'jsx' })
            .run()
        },
      },
      {
        label: 'Video',
        icon: IoPlay,
        main: true,
        name: 'iframe',
        handleClick: () => {
          setModal('video')
        },
      },
      {
        label: 'List',
        icon: IoList,
        main: true,
        name: 'bulletList',
        handleClick: () => {
          chain.toggleSlab().toggleBulletList().run()
        },
      },
      {
        label: 'Image',
        icon: IoImage,
        main: true,
        name: 'image',
        handleClick: () => {
          setModal('image')
        },
      },
    ]
  }, [])

  const [modal, setModal] = useState<'video' | 'image' | undefined>()

  return (
    <>
      <div
        style={{
          maxWidth: 300,
        }}
        className="rounded-md p-3 font-sans bg-white shadow-lg whitespace-pre-wrap"
      >
        <Heading className="text-gray-800" fontSize="extra-small">
          What would you like to add
        </Heading>
        <Text fontSize="small" className="text-gray-600 mt-2">
          Each block will be part of your timeline. You can edit and rearrange
          them.
        </Text>
        <div className="grid grid-cols-3 gap-3 mt-4">
          {tabs().map((tab) => {
            return (
              <BlockTab
                handleClick={tab.handleClick}
                key={tab.label}
                label={tab.label}
                icon={tab.icon}
              />
            )
          })}
        </div>
      </div>
      <VideoModal
        handleClose={() => setModal(undefined)}
        open={modal === 'video'}
        handleUrl={(url) => {
          chain.toggleSlab().addIframe({ src: url }).run()
          setModal(undefined)
        }}
      />
      <ImageModal
        handleClose={() => setModal(undefined)}
        open={modal === 'image'}
        handleUrl={(url) => {
          chain.toggleSlab().insertImage({ src: url }).run()
          setModal(undefined)
        }}
      />
    </>
  )
}

export default EmptyState
