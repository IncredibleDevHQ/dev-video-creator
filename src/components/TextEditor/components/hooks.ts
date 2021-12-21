import { useActive, useCommands, useHelpers, useKeymap } from '@remirror/react'
import React, { useCallback, useMemo } from 'react'
import { Node } from '@remirror/pm/model'
import { RemirrorEventListenerProps } from 'remirror'
import { TextEditorProvider } from '.'
import { useUtils } from '../../../modules/Flick/editor/utils/utils'

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
      // simpleASTCallback?.(getSimpleAST(json))
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
      const block: Node = state?.selection.$anchor.path.find(
        (n: any) => n?.type?.name === 'slab'
      )

      const simpleBlock = simpleAST?.blocks.find(
        // @ts-ignore
        (b) => b.id === block?.attrs.id
      )

      handleActiveBlock?.(simpleBlock)
    }, [state, simpleAST])
  },
]

export default hooks
