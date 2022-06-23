import { cx } from '@emotion/css'
import { HocuspocusProvider, WebSocketStatus } from '@hocuspocus/provider'
import UniqueID from '@tiptap-pro/extension-unique-id'
import { Editor as CoreEditor } from '@tiptap/core'
import CharacterCount from '@tiptap/extension-character-count'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import Focus from '@tiptap/extension-focus'
import Placeholder from '@tiptap/extension-placeholder'
import { Editor, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import React, { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useRecoilValue } from 'recoil'
import * as Y from 'yjs'
import { emitToast } from '../../../components'
import config from '../../../config'
import { User, userState } from '../../../stores/user.store'
import CodeBlock from '../editor/blocks/CodeBlock'
import ImageBlock from '../editor/blocks/ImageBlock'
import InteractionBlock from '../editor/blocks/InteractionBlock'
import VideoBlock from '../editor/blocks/VideoBlock'
import { getSuggestionItems } from '../editor/slashCommand/items'
import renderItems from '../editor/slashCommand/renderItems'
import { SlashCommands } from '../editor/slashCommand/SlashCommands'
import editorStyle from '../editor/style'
import { DragHandler } from '../editor/utils/drag'
import { TrailingNode } from '../editor/utils/trailingNode'
import CustomTypography from '../editor/utils/typography'

export const EditorContext = React.createContext<{
  editor: Editor | null
  dragHandleRef: React.RefObject<HTMLDivElement>
  editorSaved: boolean | undefined
  providerWebsocketState: WebSocketStatus
} | null>(null)

export function generateLightColorHex() {
  let color = '#'
  for (let i = 0; i < 3; i += 1)
    color += `0${Math.floor(((1 + Math.random()) * 16 ** 2) / 2).toString(
      16
    )}`.slice(-2)
  return color
}

export const EditorProvider = ({
  children,
  handleUpdate,
}: {
  children: JSX.Element
  handleUpdate?: (editor: CoreEditor) => void
}): JSX.Element => {
  const dragRef = useRef<HTMLDivElement>(null)

  const providerRef = useRef<HocuspocusProvider>()
  const yDocRef = useRef<Y.Doc>()

  const [unsyncedChanges, setUnsyncedChanges] = useState(0)
  const [websocketStatus, setWebsocketStatus] = useState<WebSocketStatus>(
    WebSocketStatus.Disconnected
  )

  const { fragmentId } = useParams<{ id: string; fragmentId?: string }>()

  const prevFragmentId = useRef<string>()

  useEffect(() => {
    if (
      (providerRef.current || yDocRef.current || !fragmentId) &&
      fragmentId === prevFragmentId.current
    )
      return
    providerRef.current?.disconnect()
    const yDoc = new Y.Doc()
    const provider = new HocuspocusProvider({
      document: yDoc,
      url: config.hocusPocus.server,
      name: `${fragmentId}`,
      maxAttempts: 10,
      timeout: 10000,
      minDelay: 0,
      maxDelay: 0,
      delay: 0,
      broadcast: false,
      onStatus: ({ status }) => {
        setWebsocketStatus(status)
      },
      forceSyncInterval: 30000,
    })
    providerRef.current = provider
    yDocRef.current = yDoc
    prevFragmentId.current = fragmentId
  }, [fragmentId, prevFragmentId])

  const { displayName } = (useRecoilValue(userState) as User) || {}

  // const getContent = (activeFragmentId: string) => {
  //   const ev = flick?.fragments.find(
  //     (fragment) => fragment.id === activeFragmentId
  //   )?.encodedEditorValue
  //     ? Buffer.from(
  //         flick?.fragments.find((fragment) => fragment.id === activeFragmentId)
  //           ?.encodedEditorValue as string,
  //         'base64'
  //       ).toString('utf8')
  //     : ''
  //   // detect if stored editor value is in html or json format
  //   if (ev.startsWith('<') || ev === '') {
  //     return ev
  //   }
  //   return JSON.parse(ev)
  // }

  const editor = useEditor(
    {
      onUpdate: ({ editor }) => {
        handleUpdate?.(editor)
      },
      editorProps: {
        attributes: {
          class: cx(
            'prose prose-sm max-w-none w-full h-full border-none focus:outline-none',
            editorStyle
          ),
        },
      },
      autofocus: 'start',
      extensions: [
        UniqueID.configure({
          attributeName: 'id',
          types: [
            'paragraph',
            'blockquote',
            'heading',
            'bulletList',
            'orderedList',
            'codeBlock',
            'video',
            'image',
            'interaction',
          ],
        }),
        DragHandler(dragRef.current),
        Focus,
        CustomTypography,
        StarterKit.configure({
          codeBlock: false,
          history: false,
          heading: {
            levels: [1, 2, 3, 4, 5, 6],
          },
          bulletList: {
            itemTypeName: 'listItem',
          },
          dropcursor: {
            width: 3.5,
            color: '#C3E2F0',
            class: 'transition-all duration-200 ease-in-out',
          },
        }),
        SlashCommands.configure({
          suggestion: {
            items: getSuggestionItems,
            render: renderItems,
          },
        }),
        Placeholder.configure({
          showOnlyWhenEditable: true,
          includeChildren: true,
          showOnlyCurrent: false,
          emptyEditorClass: 'is-editor-empty',
          placeholder: ({ node, editor }) => {
            const headingPlaceholders: {
              [key: number]: string
            } = {
              1: 'Heading 1',
              2: 'Heading 2',
              3: 'Heading 3',
              4: 'Heading 4',
              5: 'Heading 5',
              6: 'Heading 6',
            }

            if (node.type.name === 'heading') {
              const level = node.attrs.level as number
              return headingPlaceholders[level]
            }

            if (
              node.type.name === 'paragraph' &&
              editor.getJSON().content?.length === 1
            ) {
              return 'Type / to get started'
            }

            if (node.type.name === 'paragraph') {
              const selectedNode = editor.view.domAtPos(
                editor.state.selection.from
              ).node
              if (
                selectedNode.nodeName === 'P' &&
                selectedNode.firstChild?.parentElement?.id === node.attrs.id
              ) {
                const parentNode = (editor.state.selection.$from as any).path[3]
                if (
                  parentNode?.type?.name === 'blockquote' &&
                  parentNode?.content?.content?.[
                    parentNode?.content?.content?.length - 1
                  ]?.attrs?.id === node.attrs?.id
                ) {
                  return 'Type or hit enter to exit quote'
                }
                return 'Type / for commands'
              }
            }

            return ''
          },
        }),
        CodeBlock,
        ImageBlock.configure({
          inline: false,
        }),
        VideoBlock,
        TrailingNode,
        CharacterCount.configure({
          limit: 20000,
        }),
        InteractionBlock,
      ].concat(
        yDocRef.current
          ? [
              Collaboration.configure({
                document: yDocRef.current,
              }),
              CollaborationCursor.configure({
                provider: providerRef.current,
                user: {
                  name: displayName,
                  color: generateLightColorHex(),
                },
              }),
            ]
          : []
      ),
      // content: getContent(activeFragmentId),
    },
    [dragRef.current, yDocRef.current, displayName]
  )

  useEffect(() => {
    ;(async () => {
      let timeout: NodeJS.Timeout | null = null
      if (providerRef.current?.hasUnsyncedChanges) {
        // It takes a fraction of a second to sync, so we wait a bit before setting the no of unsynced changes
        timeout = setTimeout(() => {
          setUnsyncedChanges(providerRef.current?.unsyncedChanges || 0)
        }, 250)
        // await providerRef.current.connect()
      } else {
        // If there are no unsynced changes, we can set the no of unsynced changes to 0 and clear the timeout
        if (timeout) clearTimeout(timeout)
        setUnsyncedChanges(0)
      }
    })()
  }, [
    providerRef?.current?.unsyncedChanges,
    providerRef.current?.hasUnsyncedChanges,
  ])

  useEffect(() => {
    const saveHandler = (e: KeyboardEvent) => {
      if (
        e.key === 's' &&
        (navigator.userAgent.match('Mac') ? e.metaKey : e.ctrlKey)
      ) {
        e.preventDefault()
        providerRef.current?.connect()
        providerRef.current?.forceSync()
        emitToast({
          title: 'Your changes will be autosaved',
          type: 'info',
          autoClose: 1500,
        })
      }
    }

    document.addEventListener('keydown', saveHandler, false)

    return () => {
      editor?.destroy()
      providerRef.current?.destroy()
      document.removeEventListener('keydown', saveHandler, false)
    }
  }, [])

  return (
    <EditorContext.Provider
      value={{
        editor,
        dragHandleRef: dragRef,
        editorSaved: unsyncedChanges === 0,
        providerWebsocketState: websocketStatus,
      }}
    >
      {children}
    </EditorContext.Provider>
  )
}
export default EditorProvider
