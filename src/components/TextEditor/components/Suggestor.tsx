import {
  FloatingWrapper,
  useChainedCommands,
  useCommands,
  useRemirrorContext,
  useSuggest,
} from '@remirror/react'
import React, { useCallback, useEffect, useState } from 'react'
import { getCursor } from 'remirror'
import { Node } from '@remirror/pm/model'
import {
  IoText,
  IoBrowsers,
  IoCode,
  IoPlay,
  IoImage,
  IoList,
} from 'react-icons/io5'
import { BiHeading, BiNote } from 'react-icons/bi'
import { Heading, Text } from '../..'
import { BlockTab } from '.'
import VideoModal from '../VideoModal'
import ImageModal from '../ImageModal'
import LanguageModal from '../LanguageModal'

const Suggestor = () => {
  const { view } = useRemirrorContext()
  const { change } = useSuggest({
    char: '/',
    name: 'actions-dropdown',
    matchOffset: 0,
  })

  const [location, setLocation] = useState<'doc' | 'slab' | 'dirty-slab'>('doc')
  const {
    createCodeBlock,
    toggleCallout,
    addIframe,
    toggleBulletList,
    insertImage,
    toggleSlab,
    toggleHeading,
  } = useCommands()

  // TODO: Scope for improvement...
  const tabs = useCallback(() => {
    return [
      {
        label: 'Heading',
        icon: BiHeading,
        handleClick: () => {
          toggleHeading()
        },
        location: ['dirty-slab', 'slab'],
      },
      {
        label: 'Description',
        icon: IoText,
        handleClick: () => {
          toggleCallout({ type: 'success', emoji: '💬' })
        },
        location: ['dirty-slab', 'slab'],
      },
      {
        label: 'Notes',
        icon: BiNote,
        handleClick: () => {
          toggleCallout({ type: 'info', emoji: '📝' })
        },
        location: ['dirty-slab', 'slab'],
      },
      {
        label: 'Block',
        icon: IoBrowsers,
        location: ['doc'],
        handleClick: () => {
          toggleSlab()
        },
      },
      {
        label: 'Code',
        icon: IoCode,
        main: true,
        name: 'codeBlock',
        handleClick: () => {
          setModal('code')
        },
        location: ['slab'],
      },
      {
        label: 'Video',
        icon: IoPlay,
        main: true,
        name: 'iframe',
        handleClick: () => {
          setModal('video')
        },
        location: ['slab'],
      },
      {
        label: 'List',
        icon: IoList,
        main: true,
        name: 'bulletList',
        handleClick: () => {
          toggleBulletList()
        },
        location: ['slab'],
      },
      {
        label: 'Image',
        icon: IoImage,
        main: true,
        name: 'image',
        handleClick: () => {
          setModal('image')
        },
        location: ['slab'],
      },
    ]
  }, [])

  useEffect(() => {
    const cursor = getCursor(view.state.tr.selection)

    // @ts-ignore
    const path = cursor?.path as (Node | number)[]

    if (path) {
      const nodes = path.filter((p) => p instanceof Node) as Node[]

      const slab = nodes.find((n) => n.type.name === 'slab')
      let isDirty = false

      // @ts-ignore
      slab?.descendants((node) => {
        if (isDirty) return
        isDirty = tabs().some((t) => {
          return t.name === node.type.name
        })
      })

      setLocation(
        // eslint-disable-next-line no-nested-ternary
        typeof slab !== 'undefined' ? (isDirty ? 'dirty-slab' : 'slab') : 'doc'
      )
    }
  }, [view.state.tr.selection])

  const [modal, setModal] = useState<'video' | 'image' | 'code' | undefined>()
  const chain = useChainedCommands()

  return (
    <FloatingWrapper
      enabled={!!change}
      positioner="always"
      placement="auto-start"
      animated
      blurOnInactive
      renderOutsideEditor
    >
      <div
        style={{
          maxWidth: 300,
        }}
        className="rounded-md p-3 font-sans bg-white shadow-lg whitespace-pre-wrap"
      >
        <Heading className="text-gray-800" fontSize="extra-small">
          Blocks
        </Heading>
        <Text fontSize="small" className="text-gray-600 mt-2">
          {/* eslint-disable-next-line consistent-return */}
          {(() => {
            switch (location) {
              case 'doc':
                return 'Blocks are parts of your timeline.'
              case 'slab':
                return 'Add code, image, video or list to get started on this block.'
              case 'dirty-slab':
                return 'Only one type of content per block is allowed now. So you can add plain texts, notes to this block or add a new block.'
              default:
                return null
            }
          })()}
        </Text>
        <div className="grid grid-cols-3 gap-3 mt-4">
          {tabs()
            .filter((tab) => {
              const query = change?.query.full
              if (query === '' || !query) return true
              return tab.label
                .toLowerCase()
                .includes(change?.query.full.toLowerCase())
            })
            .filter((tab) => {
              return tab.location.includes(location)
            })
            .map((tab) => {
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
        handleAddVideo={(url, transformations) => {
          addIframe({ src: url, 'data-transformations': transformations })
          setModal(undefined)
        }}
      />
      <ImageModal
        handleClose={() => setModal(undefined)}
        open={modal === 'image'}
        handleUrl={(url) => {
          insertImage({ src: url })
          setModal(undefined)
        }}
      />
      <LanguageModal
        handleClose={() => setModal(undefined)}
        open={modal === 'code'}
        handleLanguage={(language) => {
          chain
            .toggleHeading({ level: 3 })
            .insertText('Heading')
            .insertHardBreak()
            .insertNewLine()
            .createCodeBlock({ code: '', layout: 'code', language })
            .insertNewLine()
            .run()
          setModal(undefined)
        }}
      />
    </FloatingWrapper>
  )
}

export default Suggestor
