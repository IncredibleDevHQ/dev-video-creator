import { css } from '@emotion/css'
import {
  createAlignPlugin,
  createAutoformatPlugin,
  createBlockquotePlugin,
  createBoldPlugin,
  createCodeBlockPlugin,
  createCodePlugin,
  createDeserializeAstPlugin,
  createDeserializeCSVPlugin,
  createDeserializeHTMLPlugin,
  createDeserializeMDPlugin,
  createExitBreakPlugin,
  createHeadingPlugin,
  createHighlightPlugin,
  createHistoryPlugin,
  createHorizontalRulePlugin,
  createImagePlugin,
  createIndentPlugin,
  createItalicPlugin,
  createKbdPlugin,
  createLineHeightPlugin,
  createLinkPlugin,
  createListPlugin,
  createMediaEmbedPlugin,
  createNodeIdPlugin,
  createNormalizeTypesPlugin,
  createParagraphPlugin,
  createPlateComponents,
  createPlateOptions,
  createReactPlugin,
  createResetNodePlugin,
  createSelectOnBackspacePlugin,
  createSoftBreakPlugin,
  createTodoListPlugin,
  createTrailingBlockPlugin,
  createUnderlinePlugin,
  ELEMENT_MEDIA_EMBED,
  HeadingToolbar,
  insertMediaEmbed,
  Plate,
  PlatePlugin,
  PEditor,
  TNode,
  usePlateEditorRef,
} from '@udecode/plate'
import React, { useMemo } from 'react'
import { useRecoilValue } from 'recoil'
import { serialize } from 'remark-slate'
import { HistoryEditor } from 'slate-history'
import { ReactEditor } from 'slate-react'
import {
  useGetCodeExplanationMutation,
  useGetSuggestedTextMutation,
} from '../../../generated/graphql'
import {
  BallonToolbarMarks,
  ToolbarButtons,
} from '../../../utils/plateConfig/components/Toolbars'
import { withStyledPlaceHolders } from '../../../utils/plateConfig/components/withStyledPlaceholders'
import { CONFIG } from '../../../utils/plateConfig/plateEditorConfig'
import { newFlickStore } from '../store/flickNew.store'

type TEditor = PEditor & ReactEditor & HistoryEditor

const FragmentEditor = ({
  value,
  setValue,
}: {
  value: TNode<any>[] | undefined
  setValue: React.Dispatch<React.SetStateAction<TNode<any>[] | undefined>>
}) => {
  const components = withStyledPlaceHolders(createPlateComponents())
  const options = createPlateOptions()

  const { activeFragmentId } = useRecoilValue(newFlickStore)
  const editor = usePlateEditorRef()

  const [getSuggestedText] = useGetSuggestedTextMutation()
  const [getCodeExplanation] = useGetCodeExplanationMutation()

  // @ts-ignore
  const pluginsMemo: PlatePlugin<TEditor>[] = useMemo(() => {
    const plugins = [
      createReactPlugin(),
      createHistoryPlugin(),
      createParagraphPlugin(),
      createBlockquotePlugin(),
      createTodoListPlugin(),
      createHeadingPlugin(),
      createImagePlugin(),
      createHorizontalRulePlugin(),
      createLinkPlugin(),
      createListPlugin(),
      createLineHeightPlugin(),
      createMediaEmbedPlugin(),
      createCodeBlockPlugin(),
      createAlignPlugin(CONFIG.align),
      createBoldPlugin(),
      createCodePlugin(),
      createItalicPlugin(),
      createHighlightPlugin(),
      createUnderlinePlugin(),
      createKbdPlugin(),
      createNodeIdPlugin(),
      createIndentPlugin(CONFIG.indent),
      createAutoformatPlugin(CONFIG.autoformat),
      createResetNodePlugin(CONFIG.resetBlockType),
      createSoftBreakPlugin(CONFIG.softBreak),
      createExitBreakPlugin(CONFIG.exitBreak),
      createNormalizeTypesPlugin(CONFIG.forceLayout),
      createTrailingBlockPlugin(CONFIG.trailingBlock),
      createSelectOnBackspacePlugin(CONFIG.selectOnBackspace),
    ]

    plugins.push(
      ...[
        createDeserializeMDPlugin({ plugins }),
        createDeserializeCSVPlugin({ plugins }),
        createDeserializeHTMLPlugin({ plugins }),
        createDeserializeAstPlugin({ plugins }),
      ]
    )

    return plugins
  }, [editor, activeFragmentId])

  const onKeysHandler = async (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!value) return
    if (e.ctrlKey && e.key === ' ') {
      e.preventDefault()
      e.stopPropagation()
      const explanation = await getCodeExplanation({
        variables: {
          code: value
            .filter((block) => block.type === 'code_block')
            .map((block) => serialize(block))
            .join('\n'),
        },
      })
      editor?.insertBreak()
      editor?.insertText(explanation.data?.ExplainCode?.description || '')
    }
    if (e.ctrlKey && e.key === '/') {
      e.preventDefault()
      e.stopPropagation()
      const explanation = await getSuggestedText({
        variables: {
          text: value.map((block) => serialize(block)).join('\n'),
        },
      })
      editor?.insertText(explanation.data?.SuggestPhrase?.suggestion || '')
    }
  }

  const insertMedia = (url: string) => {
    if (!editor) return
    insertMediaEmbed(editor, {
      url,
      pluginKey: ELEMENT_MEDIA_EMBED,
    })
  }

  return (
    <div
      role="button"
      tabIndex={0}
      className="flex flex-col flex-1 h-full overflow-y-scroll overflow-x-hidden cursor-text"
      onKeyDown={onKeysHandler}
    >
      <Plate
        id={activeFragmentId}
        components={components}
        options={options}
        plugins={pluginsMemo}
        editableProps={CONFIG.editableProps}
        value={value}
        onChange={(value) => {
          setValue(value)
        }}
      >
        {editor && (
          <HeadingToolbar
            className={css`
              padding: 0.5rem 1rem !important;
              top: 0;
              left: 0;
              right: 0;
            `}
          >
            <ToolbarButtons
              editor={editor}
              value={value}
              activeFragmentId={activeFragmentId}
              insertMedia={insertMedia}
            />
          </HeadingToolbar>
        )}
        <BallonToolbarMarks />
      </Plate>
    </div>
  )
}

export default FragmentEditor
