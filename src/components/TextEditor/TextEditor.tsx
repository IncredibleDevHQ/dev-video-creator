import 'remirror/styles/all.css'
import React, { useEffect, useState, FC, useCallback, useRef } from 'react'
import {
  ExtensionPriority,
  RemirrorEventListenerProps,
  SuggestExtension,
  uniqueId,
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
  PositionerExtension,
} from 'remirror/extensions'
import {
  EditorComponent,
  Remirror,
  ThemeProvider,
  useRemirror,
} from '@remirror/react'
import { cx } from '@emotion/css'
import { Block, SimpleAST } from './utils'
import { VideoExtension } from './plugins/VideoExtension'
import { BlockExtension } from './plugins/BlockExtension'
import {
  Positioner,
  Position,
  EmptyState,
  Exporter,
  TextEditorProvider,
  FloatingToolbar,
  Suggestor,
  ContentUpdater,
  hooks,
} from './components'
import supportedLanguages from './languages'

export interface TextEditorProps {
  placeholder?: string
  initialContent?: string
  handleUpdateSimpleAST?: (simpleAST: SimpleAST) => void
  handleUpdateJSON?: (json: string) => void
  handleUpdateMarkdown?: (markdown: string) => void
  handleActiveBlock?: (block?: Block) => void
  handleUpdatePosition?: (position?: Position) => void
}

/**
 * The editor which is used to create the annotation. Supports formatting.
 */
const TextEditor: FC<TextEditorProps> = ({
  placeholder,
  initialContent,
  children,
  handleUpdateMarkdown,
  handleUpdateJSON,
  handleActiveBlock,
  handleUpdatePosition,
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
      new PositionerExtension(),
      new IframeExtension({ enableResizing: true }),
      new ListItemExtension({
        priority: ExtensionPriority.High,
        enableCollapsible: true,
      }),
      new CodeExtension(),
      new CodeBlockExtension({ supportedLanguages }),
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

  const divRef = useRef<HTMLDivElement>(null)

  const [position, setPosition] = useState<any>()

  useEffect(() => {
    if (
      !position ||
      typeof divRef.current?.scrollTop === 'undefined' ||
      divRef.current?.scrollTop < 0 ||
      position.top < 0
    )
      return handleUpdatePosition?.(undefined)

    return handleUpdatePosition?.({
      ...position,
      top: position.top - divRef.current.scrollTop,
    })
  }, [divRef?.current?.scrollTop, position])

  return (
    <TextEditorProvider.Provider
      value={{
        state,
        simpleASTCallback,
        simpleAST,
        handleActiveBlock,
        handleUpdatePosition: setPosition,
      }}
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
          {state.doc.nodeSize <= 4 && (
            <div className="flex justify-center flex-1 items-center">
              <EmptyState />
            </div>
          )}
          <div
            ref={divRef}
            className="relative grid gap-x-4 h-full grid-cols-4 overflow-y-scroll"
          >
            <div className="col-span-4">
              <div
                className={cx({ hidden: state.doc.nodeSize <= 4 }, 'w-full')}
              >
                <EditorComponent />
              </div>
            </div>

            <Suggestor />
            <ContentUpdater content={initialContent} />
            <Exporter
              state={state}
              handleUpdateJSON={handleUpdateJSON}
              handleUpdateMarkdown={handleUpdateMarkdown}
            />
            <FloatingToolbar
              placement="auto"
              enabled
              animated
              positioner="selection"
            />
            <Positioner />
          </div>
          {children}
        </Remirror>
      </ThemeProvider>
    </TextEditorProvider.Provider>
  )
}

export default TextEditor
