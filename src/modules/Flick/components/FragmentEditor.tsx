import React, { useMemo } from 'react'
import {
  createAlignPlugin,
  createAutoformatPlugin,
  createBlockquotePlugin,
  createBoldPlugin,
  createCodeBlockPlugin,
  createCodePlugin,
  createComboboxPlugin,
  createDeserializeAstPlugin,
  createDeserializeCSVPlugin,
  createDeserializeHTMLPlugin,
  createDeserializeMDPlugin,
  createExitBreakPlugin,
  createFontBackgroundColorPlugin,
  createFontColorPlugin,
  createFontFamilyPlugin,
  createFontSizePlugin,
  createFontWeightPlugin,
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
  createMentionPlugin,
  createNodeIdPlugin,
  createNormalizeTypesPlugin,
  createParagraphPlugin,
  createPlateComponents,
  createPlateOptions,
  createReactPlugin,
  createResetNodePlugin,
  createSelectOnBackspacePlugin,
  createSoftBreakPlugin,
  createStrikethroughPlugin,
  createSubscriptPlugin,
  createSuperscriptPlugin,
  createTablePlugin,
  createTodoListPlugin,
  createTrailingBlockPlugin,
  createUnderlinePlugin,
  HeadingToolbar,
  Plate,
  PlatePlugin,
  SPEditor,
  useFindReplacePlugin,
  useStoreEditorState,
} from '@udecode/plate'
import { serialize } from 'remark-slate'
import { ReactEditor } from 'slate-react'
import { HistoryEditor } from 'slate-history'
import { BlockType, LeafType } from 'remark-slate/dist/serialize'
import { css } from '@emotion/css'
import {
  BallonToolbarMarks,
  ToolbarButtons,
} from '../../../utils/plateConfig/components/Toolbars'
import { VALUES } from '../../../utils/plateConfig/values/values'
import { CONFIG } from '../../../utils/plateConfig/plateEditorConfig'
import { withStyledPlaceHolders } from '../../../utils/plateConfig/components/withStyledPlaceholders'

type TEditor = SPEditor & ReactEditor & HistoryEditor

const id = 'Examples/Playground'

const FragmentEditor = () => {
  const components = withStyledPlaceHolders(createPlateComponents())
  const options = createPlateOptions()

  const editorRef = useStoreEditorState(id)

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
      // createTablePlugin(),
      // createFontFamilyPlugin(),
      createLineHeightPlugin(),
      // createFontWeightPlugin(),
      createMediaEmbedPlugin(),
      createCodeBlockPlugin(),
      createAlignPlugin(CONFIG.align),
      createBoldPlugin(),
      createCodePlugin(),
      createItalicPlugin(),
      createHighlightPlugin(),
      createUnderlinePlugin(),
      // createStrikethroughPlugin(),
      // createSubscriptPlugin(),
      // createSuperscriptPlugin(),
      // createFontColorPlugin(),
      // createFontBackgroundColorPlugin(),
      // createFontSizePlugin(),
      createKbdPlugin(),
      createNodeIdPlugin(),
      // createIndentPlugin(CONFIG.indent),
      createAutoformatPlugin(CONFIG.autoformat),
      createResetNodePlugin(CONFIG.resetBlockType),
      createSoftBreakPlugin(CONFIG.softBreak),
      createExitBreakPlugin(CONFIG.exitBreak),
      createNormalizeTypesPlugin(CONFIG.forceLayout),
      createTrailingBlockPlugin(CONFIG.trailingBlock),
      createSelectOnBackspacePlugin(CONFIG.selectOnBackspace),
      // createComboboxPlugin(),
      createMentionPlugin(),
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
  }, [editorRef])

  return (
    <div className="overflow-x-hidden relative">
      <Plate
        id={id}
        components={components}
        options={options}
        plugins={pluginsMemo}
        editableProps={CONFIG.editableProps}
        onChange={(value) => {
          console.log(value)
          console.log(
            value
              .map((v) => {
                switch (v.type) {
                  case 'p':
                    return serialize({ ...v, type: 'paragraph' })
                  case 'h1':
                    return serialize({ ...v, type: 'heading_one' })
                  default:
                    return serialize(v as BlockType | LeafType)
                }
              })
              .join('\n')
          )
        }}
      >
        {editorRef && (
          <HeadingToolbar
            className={css`
              padding: 0.5rem 1rem !important;
              top: 0;
              left: 0;
              right: 0;
            `}
          >
            <ToolbarButtons editor={editorRef} />
          </HeadingToolbar>
        )}
        <BallonToolbarMarks />
      </Plate>
    </div>
  )
}

export default FragmentEditor
