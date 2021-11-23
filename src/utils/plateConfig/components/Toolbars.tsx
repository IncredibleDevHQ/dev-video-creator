import { ApolloQueryResult } from '@apollo/client'
import { css, cx } from '@emotion/css'
import {
  addColumn,
  addRow,
  AlignToolbarButton,
  BalloonToolbar,
  BlockToolbarButton,
  CodeBlockToolbarButton,
  deleteColumn,
  deleteRow,
  deleteTable,
  ELEMENT_CODE_BLOCK,
  ELEMENT_H1,
  ELEMENT_UL,
  getPlatePluginType,
  getPreventDefaultHandler,
  ImageToolbarButton,
  indent,
  insertNodes,
  insertTable,
  ListToolbarButton,
  MarkToolbarButton,
  MARK_BOLD,
  MARK_HIGHLIGHT,
  MARK_ITALIC,
  MARK_KBD,
  MARK_UNDERLINE,
  MediaEmbedToolbarButton,
  outdent,
  PEditor,
  TableToolbarButton,
  TNode,
  ToolbarButton,
  usePlateEditorRef,
  usePlateEditorState,
} from '@udecode/plate'
import React, { useEffect, useState } from 'react'
import { BiHeading } from 'react-icons/bi'
import { FiCheckCircle, FiXCircle } from 'react-icons/fi'
import {
  MdBorderAll,
  MdBorderBottom,
  MdBorderClear,
  MdBorderLeft,
  MdBorderRight,
  MdBorderTop,
  MdFormatBold,
  MdFormatItalic,
  MdFormatListBulleted,
  MdFormatUnderlined,
  MdHighlight,
  MdImage,
  MdKeyboard,
  MdOndemandVideo,
  MdOutlineCode,
  MdOutlineFormatAlignCenter,
  MdOutlineFormatAlignLeft,
  MdOutlineFormatAlignRight,
  MdOutlineFormatBold,
  MdOutlineFormatIndentDecrease,
  MdOutlineFormatIndentIncrease,
  MdOutlineFormatItalic,
  MdOutlineFormatUnderlined,
  MdVideoLibrary,
} from 'react-icons/md'
import { useRecoilValue } from 'recoil'
import { serialize } from 'remark-slate'
import { HistoryEditor } from 'slate-history'
import { ReactEditor } from 'slate-react'
import { Button } from '../../../components'
import {
  useGetCodeExplanationMutation,
  useGetSuggestedTextMutation,
  UserAssetQuery,
  UserAssetQueryVariables,
} from '../../../generated/graphql'
import { VideoInventoryModal } from '../../../modules/Flick/components'
import firebaseState from '../../../stores/firebase.store'
import { CodejamConfig, ConfigType } from '../../configTypes'
import { serializeDataConfig } from '../serializer/config-serialize'

export const ToolbarButtonsBasicElements = () => {
  const editor = usePlateEditorRef()

  return (
    <>
      <BlockToolbarButton
        type={getPlatePluginType(editor, ELEMENT_H1)}
        icon={<BiHeading />}
        classNames={{
          active: css`
            color: #16a34a !important;
          `,
        }}
      />
      {/* <ToolbarElement
        type={getPlatePluginType(editor, ELEMENT_H2)}
        icon={<MdOutlineLooksTwo />}
      />
      <ToolbarElement
        type={getPlatePluginType(editor, ELEMENT_H3)}
        icon={<MdOutlineLooks3 />}
      />
      <ToolbarElement
        type={getPlatePluginType(editor, ELEMENT_H4)}
        icon={<MdOutlineLooks4 />}
      />
      <ToolbarElement
        type={getPlatePluginType(editor, ELEMENT_H5)}
        icon={<MdOutlineLooks5 />}
      />
      <ToolbarElement
        type={getPlatePluginType(editor, ELEMENT_H6)}
        icon={<MdOutlineLooks6 />}
      /> 
      <ToolbarElement
        type={getPlatePluginType(editor, ELEMENT_BLOCKQUOTE)}
        icon={<MdOutlineFormatQuote />}
      /> */}
      <CodeBlockToolbarButton
        type={getPlatePluginType(editor, ELEMENT_CODE_BLOCK)}
        icon={<MdOutlineCode />}
      />
    </>
  )
}

export const ToolbarButtonsIndent = () => {
  const editor = usePlateEditorRef()

  return (
    <>
      <ToolbarButton
        onMouseDown={editor && getPreventDefaultHandler(outdent, editor)}
        icon={<MdOutlineFormatIndentDecrease />}
      />
      <ToolbarButton
        onMouseDown={editor && getPreventDefaultHandler(indent, editor)}
        icon={<MdOutlineFormatIndentIncrease />}
      />
    </>
  )
}

export const ToolbarButtonsList = () => {
  const editor = usePlateEditorRef()

  return (
    <>
      <ListToolbarButton
        type={getPlatePluginType(editor, ELEMENT_UL)}
        icon={<MdFormatListBulleted />}
      />
      {/* <ToolbarList
        type={getPlatePluginType(editor, ELEMENT_OL)}
        icon={<MdFormatListNumbered />}
      /> */}
    </>
  )
}

export const ToolbarButtonsAlign = () => {
  return (
    <>
      <AlignToolbarButton
        value="left"
        align="left"
        icon={<MdOutlineFormatAlignLeft />}
      />
      <AlignToolbarButton
        value="center"
        align="center"
        icon={<MdOutlineFormatAlignCenter />}
      />
      <AlignToolbarButton
        value="right"
        align="right"
        icon={<MdOutlineFormatAlignRight />}
      />
      {/* <ToolbarAlign align="justify" icon={<MdOutlineFormatAlignJustify />} /> */}
    </>
  )
}

export const ToolbarButtonsBasicMarks = () => {
  const editor = usePlateEditorRef()

  return (
    <>
      <MarkToolbarButton
        type={getPlatePluginType(editor, MARK_BOLD)}
        icon={<MdOutlineFormatBold />}
      />
      <MarkToolbarButton
        type={getPlatePluginType(editor, MARK_ITALIC)}
        icon={<MdOutlineFormatItalic />}
      />
      <MarkToolbarButton
        type={getPlatePluginType(editor, MARK_UNDERLINE)}
        icon={<MdOutlineFormatUnderlined />}
      />
      {/* <ToolbarMark
        type={getPlatePluginType(editor, MARK_STRIKETHROUGH)}
        icon={<MdOutlineFormatStrikethrough />}
      /> 
      <ToolbarMark
        type={getPlatePluginType(editor, MARK_CODE)}
        icon={<BiCodeAlt />}
      />
       <ToolbarMark
        type={getPlatePluginType(editor, MARK_SUPERSCRIPT)}
        clear={getPlatePluginType(editor, MARK_SUBSCRIPT)}
        icon={<MdSuperscript />}
      />
      <ToolbarMark
        type={getPlatePluginType(editor, MARK_SUBSCRIPT)}
        clear={getPlatePluginType(editor, MARK_SUPERSCRIPT)}
        icon={<MdSubscript />}
      /> */}
    </>
  )
}

export const ToolbarKbd = () => {
  const editor = usePlateEditorRef()

  return (
    <MarkToolbarButton
      type={getPlatePluginType(editor, MARK_KBD)}
      icon={<MdKeyboard />}
    />
  )
}

export const ToolbarHighlight = () => {
  const editor = usePlateEditorRef()

  return (
    <MarkToolbarButton
      type={getPlatePluginType(editor, MARK_HIGHLIGHT)}
      icon={<MdHighlight />}
    />
  )
}

export const ToolbarButtonsTable = () => (
  <>
    <TableToolbarButton icon={<MdBorderAll />} transform={insertTable} />
    <TableToolbarButton icon={<MdBorderClear />} transform={deleteTable} />
    <TableToolbarButton icon={<MdBorderBottom />} transform={addRow} />
    <TableToolbarButton icon={<MdBorderTop />} transform={deleteRow} />
    <TableToolbarButton icon={<MdBorderLeft />} transform={addColumn} />
    <TableToolbarButton icon={<MdBorderRight />} transform={deleteColumn} />
  </>
)

export const BallonToolbarMarks = () => {
  const editor = usePlateEditorRef()

  const arrow = false
  const theme = 'dark'
  const tooltip = {
    arrow: true,
    delay: 0,
    duration: [200, 0],
    hideOnClick: false,
    offset: [0, 17],
    placement: 'top',
  }

  return (
    <BalloonToolbar
      popperOptions={{
        placement: 'top',
      }}
      theme={theme}
      arrow={arrow}
    >
      <MarkToolbarButton
        type={getPlatePluginType(editor, MARK_BOLD)}
        icon={<MdFormatBold />}
        tooltip={{ content: 'Bold (⌘B)', ...(tooltip as any) }}
      />
      <MarkToolbarButton
        type={getPlatePluginType(editor, MARK_ITALIC)}
        icon={<MdFormatItalic />}
        tooltip={{ content: 'Italic (⌘I)', ...(tooltip as any) }}
      />
      <MarkToolbarButton
        type={getPlatePluginType(editor, MARK_UNDERLINE)}
        icon={<MdFormatUnderlined />}
        tooltip={{ content: 'Underline (⌘U)', ...(tooltip as any) }}
      />
    </BalloonToolbar>
  )
}

export const GenerateExplanationButton = ({
  value,
  insertText,
  deleteText,
  activeFragmentId,
}: {
  value?: TNode<any>[]
  activeFragmentId: string
  deleteText: () => void
  insertText: (text: string) => void
}) => {
  const editorState = usePlateEditorState(activeFragmentId)
  const [isExplanation, setExplanation] = useState(false)
  const [getSuggestedText, { loading: explanationLoading }] =
    useGetSuggestedTextMutation()
  const [getCodeExplanation, { loading: codeLoading }] =
    useGetCodeExplanationMutation()

  const fbState = useRecoilValue(firebaseState)

  return (
    <div className="mx-2 flex justify-end items-center">
      {isExplanation && (
        <>
          <FiCheckCircle
            size={20}
            className="text-success mx-1"
            onClick={() => {
              setExplanation(false)
            }}
          />
          <FiXCircle
            size={20}
            className="text-error mx-1"
            onClick={() => {
              deleteText()
              setExplanation(false)
            }}
          />
        </>
      )}
      <Button
        type="button"
        size="extraSmall"
        appearance="secondary"
        disabled={isExplanation || explanationLoading}
        onClick={async () => {
          if (!value || value.length < 1) return
          const explanation = await getSuggestedText({
            variables: {
              text: value.map((block) => serialize(block)).join('\n'),
            },
          })
          insertText(explanation.data?.SuggestPhrase?.suggestion || '')
          setExplanation(true)
        }}
      >
        {explanationLoading ? 'Loading...' : 'Generate Explanation'}
      </Button>
      <Button
        type="button"
        className="ml-2"
        size="extraSmall"
        appearance="secondary"
        disabled={isExplanation || codeLoading}
        onClick={async () => {
          if (!value || value.length < 1 || !editorState) return

          const codeText: TNode = value
            .filter((block) => block.type === 'code_block')
            .pop()

          const { token } = fbState
          const config = await serializeDataConfig(
            [codeText as TNode],
            token as string,
            undefined // because video assets config would not have changed on gpt3 generation
          )
          const codeConfig = config.find(
            (c) => c.type === ConfigType.CODEJAM
          ) as CodejamConfig
          const explanation = await getCodeExplanation({
            variables: {
              code: codeConfig.value.code,
            },
          })
          editorState.insertBreak()
          editorState.insertText(
            explanation.data?.ExplainCode?.description || ''
          )
          setExplanation(true)
        }}
      >
        {codeLoading ? 'Loading...' : 'Get Code Explanation'}
      </Button>
    </div>
  )
}

export const ToolbarButtons = ({
  value,
  editor,
  activeFragmentId,
  insertMedia,
  assetsData,
  refetchAssetsData,
}: {
  value?: TNode<any>[]
  activeFragmentId: string
  insertMedia: (url: string) => void
  editor: PEditor & ReactEditor & HistoryEditor
  assetsData?: UserAssetQuery
  refetchAssetsData: (
    variables?: UserAssetQueryVariables
  ) => Promise<ApolloQueryResult<UserAssetQuery>>
}) => {
  const [isVideoModal, setVideoModal] = useState(false)
  const [selectedVideo, setSelectedVideo] = useState<string>('')

  useEffect(() => {
    if (!selectedVideo || selectedVideo.length < 1) return
    insertMedia(selectedVideo)
  }, [selectedVideo])

  const insertTextToEditor = (text: string) => {
    editor.insertBreak()
    insertNodes(editor, { text, type: 'text' }, { block: true, select: true })
  }

  const deleteTextFromEditor = () => {
    editor.undo()
  }

  return (
    <div
      className={cx(
        'flex w-full justify-between items-center',
        css`
          padding-left: 1rem;
          padding-right: 1rem;
        `
      )}
    >
      <div className="flex items-center">
        <ToolbarButtonsBasicElements />
        <ToolbarButtonsList />
        {/* <ToolbarButtonsIndent /> */}
        <ToolbarButtonsBasicMarks />
        {/* <ToolbarColorPicker pluginKey={MARK_COLOR} icon={<MdFormatColorText />} />
    <ToolbarColorPicker pluginKey={MARK_BG_COLOR} icon={<MdFontDownload />} /> */}
        <ToolbarButtonsAlign />
        {/* <ToolbarLink icon={<MdLink />} /> */}
        <ImageToolbarButton icon={<MdImage />} />
        <MediaEmbedToolbarButton icon={<MdOndemandVideo />} />
        {/* <ToolbarButtonsTable /> */}
        <MdVideoLibrary onClick={() => setVideoModal(true)} />
      </div>
      <GenerateExplanationButton
        value={value}
        activeFragmentId={activeFragmentId}
        insertText={insertTextToEditor}
        deleteText={deleteTextFromEditor}
      />
      <VideoInventoryModal
        open={isVideoModal}
        setSelectedVideoLink={setSelectedVideo}
        handleClose={() => {
          setVideoModal(false)
        }}
        assetsData={assetsData}
        refetchAssetsData={refetchAssetsData}
      />
    </div>
  )
}
