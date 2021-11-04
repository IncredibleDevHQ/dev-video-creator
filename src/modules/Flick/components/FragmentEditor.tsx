import React, { useEffect, useMemo, useState } from 'react'
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
  createTodoListPlugin,
  createTrailingBlockPlugin,
  createUnderlinePlugin,
  HeadingToolbar,
  Plate,
  PlatePlugin,
  SPEditor,
  TNode,
  useStoreEditorState,
} from '@udecode/plate'
import { ReactEditor } from 'slate-react'
import { HistoryEditor } from 'slate-history'
import { css } from '@emotion/css'
import { useRecoilState } from 'recoil'
import {
  BallonToolbarMarks,
  ToolbarButtons,
} from '../../../utils/plateConfig/components/Toolbars'
import { CONFIG } from '../../../utils/plateConfig/plateEditorConfig'
import { withStyledPlaceHolders } from '../../../utils/plateConfig/components/withStyledPlaceholders'
import mdSerialize from '../../../utils/plateConfig/serializer/md-serialize'
import { serializeDataConfig } from '../../../utils/plateConfig/serializer/config-serialize'
import { useGetTokenisedCodeLazyQuery } from '../../../generated/graphql'
import { authState } from '../../../stores/auth.store'
// import { serializeDataConfig } from '../../../utils/plateConfig/serializer/config-serialize'
// import mdSerialize from '../../../utils/plateConfig/serializer/md-serialize'

type TEditor = SPEditor & ReactEditor & HistoryEditor

const id = 'Examples/Playground'

const FragmentEditor = () => {
  const components = withStyledPlaceHolders(createPlateComponents())
  const options = createPlateOptions()

  const [value, setValue] = useState<TNode<any>[]>()
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

  // user token is need to make the api call to get the color-codes
  // const [auth] = useRecoilState(authState)

  // useEffect(() => {
  //   if (val) {
  //     ;(async () => {
  //       try {
  //         const c = await serializeDataConfig(val, auth?.token || '')
  //         console.log('data config: ', JSON.stringify(c))
  //       } catch (e) {
  //         console.error(e)
  //         throw e
  //       }
  //     })()
  //   }
  // }, [val])

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden pb-32">
      <Plate
        id={id}
        components={components}
        options={options}
        plugins={pluginsMemo}
        editableProps={CONFIG.editableProps}
        value={value}
        onChange={(value) => {
          setValue(value)
          console.log(value)
          // setVal(value)
          // This can be stored in database or can be called to generate on demand
          // console.log(value.map((block) => mdSerialize(block)).join('\n'))
          // get the data config
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
            <ToolbarButtons editor={editorRef} value={value} />
          </HeadingToolbar>
        )}
        <BallonToolbarMarks />
      </Plate>
    </div>
  )
}

export default FragmentEditor
