import 'remirror/styles/all.css'
import React, { useEffect, useMemo, useState, FC, useCallback } from 'react'
import jsx from 'refractor/lang/jsx'
import typescript from 'refractor/lang/typescript'
import {
  ExtensionPriority,
  RemirrorEventListenerProps,
  SuggestExtension,
  getCursor,
  ComponentsTheme,
  uniqueId,
  EditorState,
} from 'remirror'
import {
  BoldExtension,
  BulletListExtension,
  CodeBlockExtension,
  CodeExtension,
  HardBreakExtension,
  HeadingExtension,
  LinkExtension,
  ListItemExtension,
  MarkdownExtension,
  StrikeExtension,
  TableExtension,
  TrailingNodeExtension,
  CalloutExtension,
  ItalicExtension,
  PlaceholderExtension,
  IframeExtension,
  ImageExtension,
} from 'remirror/extensions'
import {
  EditorComponent,
  Remirror,
  ThemeProvider,
  useRemirror,
  useKeymap,
  useHelpers,
  useCommands,
  useRemirrorContext,
  useSuggest,
  FloatingWrapper,
  useActive,
  useChainedCommands,
} from '@remirror/react'
import { IconType } from 'react-icons'
import {
  IoBrowsers,
  IoCode,
  IoImage,
  IoList,
  IoPlay,
  IoText,
} from 'react-icons/io5'
import { BiBrain, BiNote } from 'react-icons/bi'
import { Node } from '@remirror/pm/model'
import { cx } from '@emotion/css'
import { Block, SimpleAST, useUtils } from './utils'
import { VideoExtension } from './plugins/VideoExtension'
import { BlockExtension } from './plugins/BlockExtension'
import { Heading, Text } from '..'
import VideoModal from './VideoModal'
import ImageModal from './ImageModal'

export interface TextEditorProps {
  placeholder?: string
  initialContent?: string
  titleProps?: {
    title?: string
    enabled?: boolean
    editable?: boolean
    handleChange?: (newTitle: string) => void
  }
  handleUpdateSimpleAST?: (simpleAST: SimpleAST) => void
  handleUpdateJSON?: (json: string) => void
  handleActiveBlock?: (block?: Block) => void
}

const hooks = [
  () => {
    const { getJSON, getText } = useHelpers()
    const { insertText } = useCommands()

    const onSave = useCallback(
      (props: RemirrorEventListenerProps<Remirror.Extensions>) => {
        const { state } = props

        const slice = state.selection.content()

        slice.content.descendants((descendant) => {
          if (
            descendant.type.name === 'codeBlock' &&
            slice.content.descendants.length === 1
          ) {
            const { parent, parentOffset } = state.selection.$from
            const codeBlockText = parent.textContent

            const indexOfNewLine = codeBlockText
              .substring(0, parentOffset)
              .lastIndexOf('\n')

            // console.log(
            //   indexOfNewLine,
            //   textOffset,
            //   parentOffset,
            //   state.selection.$from.pos
            // )

            insertText(
              '\n// Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.\n',
              {
                from:
                  Math.max(indexOfNewLine, 0) +
                  state.selection.$from.pos -
                  parentOffset,
              }
            )

            // replaceText({
            //   selection: state.selection,
            //   content: state.selection,
            // })
          }

          return false
        })

        return true // Prevents any further key handlers from being run.
      },
      [getJSON, getText]
    )

    const onSuggest = useCallback(
      (props: RemirrorEventListenerProps<Remirror.Extensions>) => {
        // const { state } = props
        // insertText('Consequat proident do laborum et ut.', {
        //   marks: { strike: {} },
        // })
      },
      []
    )

    // @ts-ignore
    useKeymap('Mod-s', onSave)
    // @ts-ignore
    useKeymap('Tab', onSuggest)
  },
  () => {
    const { getJSON } = useHelpers()
    const { getSimpleAST } = useUtils()
    const { state, simpleASTCallback } = React.useContext(TextEditorProvider)

    useMemo(() => {
      const json = getJSON(state)
      simpleASTCallback?.(getSimpleAST(json))
    }, [state])
  },
  () => {
    const { state, simpleAST, handleActiveBlock } =
      React.useContext(TextEditorProvider)

    const { slab } = useActive(true)

    // eslint-disable-next-line consistent-return
    useMemo(() => {
      if (!slab) return undefined

      // @ts-ignore
      const block: Node = state.selection.$anchor.path.find(
        (n: any) => n?.type?.name === 'slab'
      )
      const simpleBlock = simpleAST?.blocks.find(
        (b) => b.id === block?.attrs.id
      )

      handleActiveBlock?.(simpleBlock)
    }, [state, simpleAST])
  },
]

const TextEditorProvider = React.createContext<{
  state?: EditorState
  simpleASTCallback?: (simpleAST: SimpleAST) => void
  simpleAST?: SimpleAST
  handleActiveBlock?: (block: Block | undefined) => void
}>({} as any)

/**
 * The editor which is used to create the annotation. Supports formatting.
 */
const TextEditor: FC<TextEditorProps> = ({
  placeholder,
  initialContent,
  children,
  titleProps,
  handleUpdateJSON,
  handleActiveBlock,
}) => {
  const extensions = useCallback(
    () => [
      new PlaceholderExtension({ placeholder }),
      new LinkExtension({ autoLink: true }),
      new BoldExtension(),
      new StrikeExtension(),
      new ItalicExtension(),
      new HeadingExtension({
        levels: [1, 2, 3],
      }),
      new LinkExtension(),
      // new BlockquoteExtension(),
      new BlockExtension({}),
      new BulletListExtension(),
      new ImageExtension({
        enableResizing: true,
      }),
      new IframeExtension({ enableResizing: true }),
      new ListItemExtension({
        priority: ExtensionPriority.High,
        enableCollapsible: true,
      }),
      new CodeExtension(),
      new CodeBlockExtension({ supportedLanguages: [jsx, typescript] }),
      new TrailingNodeExtension(),
      new TableExtension(),
      new MarkdownExtension({ copyAsMarkdown: false }),
      new HardBreakExtension(),
      new SuggestExtension(),
      // new PredictionExtension({
      //   handlePrediction: () => {
      //     console.log('prediction handler')
      //     return new Promise(() => {})
      //   },
      // }),
      new VideoExtension(),
      new CalloutExtension(),
    ],
    [placeholder]
  )

  const [title] = useState(titleProps?.title)

  const { manager, state, setState } = useRemirror({
    extensions,
    stringHandler: 'markdown',
    extraAttributes: [
      { identifiers: 'nodes', attributes: { id: () => uniqueId() } },
    ],
    content: initialContent,
  })

  const handleChange = (
    props: RemirrorEventListenerProps<Remirror.Extensions>
  ) => {
    setState(props.state)
  }

  const [simpleAST, setSimpleAST] = useState<SimpleAST>()

  const simpleASTCallback = useCallback((simpleAST: SimpleAST) => {
    setSimpleAST(simpleAST)
  }, [])

  return (
    <TextEditorProvider.Provider
      value={{ state, simpleASTCallback, simpleAST, handleActiveBlock }}
    >
      <ThemeProvider>
        <Remirror
          classNames={['focus:outline-none', 'border-none', 'font-mono']}
          manager={manager}
          autoFocus
          state={state}
          onChange={handleChange}
          hooks={hooks}
        >
          {/* <Toolbar items={toolbarItems} refocusEditor label="Top Toolbar" /> */}
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-to-interactive-role */}
          <h1
            className="text-4xl font-bold mb-8 focus:outline-none"
            // contentEditable
            // role="textbox"
          >
            {title}
          </h1>
          {state.doc.nodeSize <= 4 && (
            <div className="flex justify-center flex-1 items-center">
              <EmptyState />
            </div>
          )}
          <div className="relative grid gap-x-4 h-full grid-cols-4">
            <div className="col-span-4">
              <div
                className={cx({ hidden: state.doc.nodeSize <= 4 }, 'w-full')}
              >
                <EditorComponent />
              </div>
            </div>

            <Suggestor />
            <ContentUpdater content={initialContent} />
            <Exporter state={state} handleUpdateJSON={handleUpdateJSON} />
            <FloatingToolbar
              placement="auto"
              enabled
              animated
              positioner="selection"
            />
          </div>
          {children}
        </Remirror>
      </ThemeProvider>
    </TextEditorProvider.Provider>
  )
}

const BlockTab = ({
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

function ContentUpdater({ content }: { content: any }) {
  const { setContent } = useRemirrorContext()

  useEffect(() => {
    setContent(content)
  }, [content])

  return null
}

function Suggestor() {
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
  } = useCommands()

  // TODO: Scope for improvement...
  const tabs = useCallback(() => {
    return [
      {
        label: 'Text',
        icon: IoText,
        handleClick: () => {
          toggleCallout({ type: 'success', emoji: '💬' })
        },
        location: ['dirty-slab'],
      },
      {
        label: 'Notes',
        icon: BiNote,
        handleClick: () => {
          toggleCallout({ type: 'info', emoji: '📝' })
        },
        location: ['dirty-slab'],
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
          createCodeBlock({
            code: '',
            layout: 'code',
            language: 'jsx',
          })
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
    const path: (Node | number)[] = cursor?.path

    if (path) {
      const nodes = path.filter((p) => p instanceof Node) as Node[]

      const slab = nodes.find((n) => n.type.name === 'slab')
      let isDirty = false

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

  const [modal, setModal] = useState<'video' | 'image' | undefined>()

  return (
    <FloatingWrapper
      enabled={!!change}
      positioner="always"
      placement="top-start"
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
        handleUrl={(url) => {
          addIframe({ src: url })
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
    </FloatingWrapper>
  )
}
const FloatingToolbarItem = ({
  icon: I,
  label,
  disabled,
}: {
  label: string
  icon: IconType
  disabled?: boolean
}) => {
  return (
    <div
      aria-describedby={label}
      className={cx('hover:bg-gray-100 transition-colors rounded-md p-2', {
        'opacity-50 cursor-not-allowed': disabled,
      })}
    >
      <I />
    </div>
  )
}

const Exporter = ({
  state,
  handleUpdateJSON,
}: {
  state: any
  handleUpdateJSON: any
}) => {
  const { getJSON } = useHelpers()

  useMemo(() => {
    handleUpdateJSON(getJSON(state))
  }, [state])

  return null
}

export const FloatingToolbar = (props: any): JSX.Element => {
  const {
    placement,
    positioner,
    animated = 200,
    animatedClass = ComponentsTheme.ANIMATED_POPOVER,
    containerClass,
    blurOnInactive,
    enabled,
    floatingLabel,
    ignoredElements,
  } = props
  const floatingWrapperProps = {
    placement,
    positioner,
    animated,
    animatedClass,
    containerClass,
    blurOnInactive,
    enabled,
    floatingLabel,
    ignoredElements,
  }

  return (
    <FloatingWrapper renderOutsideEditor {...floatingWrapperProps}>
      <div className="p-1 grid gap-x-2 rounded-md bg-white shadow-md">
        <FloatingToolbarItem
          disabled
          label="Generate suggestions"
          icon={BiBrain}
        />
      </div>
    </FloatingWrapper>
  )
}

function EmptyState() {
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
export default TextEditor
