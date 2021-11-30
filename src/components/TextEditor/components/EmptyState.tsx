import { IconType, useChainedCommands } from '@remirror/react'
import React, { useCallback, useState } from 'react'
import { IoBrowsers, IoCode, IoImage, IoList, IoPlay } from 'react-icons/io5'
import { Heading, Text } from '../..'
import ImageModal from '../ImageModal'
import VideoModal from '../VideoModal'
import LanguageModal from '../LanguageModal'

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
          setModal('code')
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
          chain
            .toggleSlab()
            .toggleHeading({ level: 2 })
            .insertText('Heading')
            .insertNewLine()
            .toggleBulletList()
            .insertNewLine()
            .run()
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
      {
        label: 'Block',
        icon: IoBrowsers,
        main: true,
        name: 'block',
        handleClick: () => {
          chain.toggleSlab().run()
        },
      },
    ]
  }, [])

  const [modal, setModal] = useState<'video' | 'image' | 'code' | undefined>()

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
        <Text fontSize="small" className="text-gray-600 mt-2 leading-normal">
          Each block will be part of your timeline. You can edit and rearrange
          them later. You can also{' '}
          <span
            role="button"
            tabIndex={0}
            onKeyDown={undefined}
            onClick={() => {
              chain.insertNewLine().focus('start').run()
            }}
            className="cursor-pointer inline-block border-dotted pb-px border-b border-gray-700"
          >
            start blank
          </span>
          .
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
          chain
            .toggleSlab()
            .toggleHeading({ level: 2 })
            .insertText('Heading')
            .insertNewLine()
            .addIframe({ src: url })
            .insertNewLine()
            .run()
          setModal(undefined)
        }}
      />
      <ImageModal
        handleClose={() => setModal(undefined)}
        open={modal === 'image'}
        handleUrl={(url) => {
          chain
            .toggleSlab()
            .toggleHeading({ level: 2 })
            .insertText('Heading')
            .insertNewLine()
            .insertImage({ src: url })
            .insertNewLine()
            .run()
          setModal(undefined)
        }}
      />

      <LanguageModal
        handleClose={() => setModal(undefined)}
        open={modal === 'code'}
        handleLanguage={(language) => {
          chain
            .toggleSlab()
            .toggleHeading({ level: 2 })
            .insertText('Heading')
            .insertNewLine()
            .createCodeBlock({ code: '', layout: 'code', language })
            .insertNewLine()
            .run()
          setModal(undefined)
        }}
      />
    </>
  )
}

export default EmptyState
