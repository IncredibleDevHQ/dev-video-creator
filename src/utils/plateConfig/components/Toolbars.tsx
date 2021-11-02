import React, { useEffect, useState } from 'react'
import {
  addColumn,
  addRow,
  BalloonToolbar,
  deleteColumn,
  deleteRow,
  deleteTable,
  ELEMENT_BLOCKQUOTE,
  ELEMENT_CODE_BLOCK,
  ELEMENT_H1,
  ELEMENT_H2,
  ELEMENT_H3,
  ELEMENT_H4,
  ELEMENT_H5,
  ELEMENT_H6,
  ELEMENT_OL,
  ELEMENT_UL,
  getPlatePluginType,
  getPreventDefaultHandler,
  indent,
  insertEmptyElement,
  insertNodes,
  insertTable,
  MARK_BG_COLOR,
  MARK_BOLD,
  MARK_CODE,
  MARK_COLOR,
  MARK_HIGHLIGHT,
  MARK_ITALIC,
  MARK_KBD,
  MARK_STRIKETHROUGH,
  MARK_SUBSCRIPT,
  MARK_SUPERSCRIPT,
  MARK_UNDERLINE,
  outdent,
  SPEditor,
  ToolbarAlign,
  ToolbarButton,
  ToolbarCodeBlock,
  ToolbarColorPicker,
  ToolbarElement,
  ToolbarImage,
  ToolbarLink,
  ToolbarList,
  ToolbarMark,
  ToolbarMediaEmbed,
  ToolbarTable,
  useEventEditorId,
  useStoreEditorRef,
} from '@udecode/plate'
import { css, cx } from '@emotion/css'
import {
  MdBorderAll,
  MdBorderBottom,
  MdBorderClear,
  MdBorderLeft,
  MdBorderRight,
  MdBorderTop,
  MdFontDownload,
  MdFormatBold,
  MdFormatColorText,
  MdFormatItalic,
  MdFormatListBulleted,
  MdFormatListNumbered,
  MdFormatUnderlined,
  MdHighlight,
  MdImage,
  MdKeyboard,
  MdLink,
  MdOndemandVideo,
  MdOutlineCode,
  MdOutlineFormatAlignCenter,
  MdOutlineFormatAlignJustify,
  MdOutlineFormatAlignLeft,
  MdOutlineFormatAlignRight,
  MdOutlineFormatBold,
  MdOutlineFormatIndentDecrease,
  MdOutlineFormatIndentIncrease,
  MdOutlineFormatItalic,
  MdOutlineFormatQuote,
  MdOutlineFormatStrikethrough,
  MdOutlineFormatUnderlined,
  MdOutlineLooks3,
  MdOutlineLooks4,
  MdOutlineLooks5,
  MdOutlineLooks6,
  MdOutlineLooksOne,
  MdOutlineLooksTwo,
  MdSubscript,
  MdSuperscript,
} from 'react-icons/md'
import { BiCodeAlt, BiHeading } from 'react-icons/bi'
import { ReactEditor } from 'slate-react'
import { HistoryEditor } from 'slate-history'
import { FiCheckCircle, FiXCircle } from 'react-icons/fi'
import { Button } from '../../../components'

export const ToolbarButtonsBasicElements = () => {
  const editor = useStoreEditorRef(useEventEditorId('focus'))

  return (
    <>
      <ToolbarElement
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
      <ToolbarCodeBlock
        type={getPlatePluginType(editor, ELEMENT_CODE_BLOCK)}
        icon={<MdOutlineCode />}
      />
    </>
  )
}

export const ToolbarButtonsIndent = () => {
  const editor = useStoreEditorRef(useEventEditorId('focus'))

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
  const editor = useStoreEditorRef(useEventEditorId('focus'))

  return (
    <>
      <ToolbarList
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
      <ToolbarAlign align="left" icon={<MdOutlineFormatAlignLeft />} />
      <ToolbarAlign align="center" icon={<MdOutlineFormatAlignCenter />} />
      <ToolbarAlign align="right" icon={<MdOutlineFormatAlignRight />} />
      {/* <ToolbarAlign align="justify" icon={<MdOutlineFormatAlignJustify />} /> */}
    </>
  )
}

export const ToolbarButtonsBasicMarks = () => {
  const editor = useStoreEditorRef(useEventEditorId('focus'))

  return (
    <>
      <ToolbarMark
        type={getPlatePluginType(editor, MARK_BOLD)}
        icon={<MdOutlineFormatBold />}
      />
      <ToolbarMark
        type={getPlatePluginType(editor, MARK_ITALIC)}
        icon={<MdOutlineFormatItalic />}
      />
      <ToolbarMark
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
  const editor = useStoreEditorRef(useEventEditorId('focus'))

  return (
    <ToolbarMark
      type={getPlatePluginType(editor, MARK_KBD)}
      icon={<MdKeyboard />}
    />
  )
}

export const ToolbarHighlight = () => {
  const editor = useStoreEditorRef(useEventEditorId('focus'))

  return (
    <ToolbarMark
      type={getPlatePluginType(editor, MARK_HIGHLIGHT)}
      icon={<MdHighlight />}
    />
  )
}

export const ToolbarButtonsTable = () => (
  <>
    <ToolbarTable icon={<MdBorderAll />} transform={insertTable} />
    <ToolbarTable icon={<MdBorderClear />} transform={deleteTable} />
    <ToolbarTable icon={<MdBorderBottom />} transform={addRow} />
    <ToolbarTable icon={<MdBorderTop />} transform={deleteRow} />
    <ToolbarTable icon={<MdBorderLeft />} transform={addColumn} />
    <ToolbarTable icon={<MdBorderRight />} transform={deleteColumn} />
  </>
)

export const BallonToolbarMarks = () => {
  const editor = useStoreEditorRef(useEventEditorId('focus'))

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
      <ToolbarMark
        type={getPlatePluginType(editor, MARK_BOLD)}
        icon={<MdFormatBold />}
        tooltip={{ content: 'Bold (⌘B)', ...(tooltip as any) }}
      />
      <ToolbarMark
        type={getPlatePluginType(editor, MARK_ITALIC)}
        icon={<MdFormatItalic />}
        tooltip={{ content: 'Italic (⌘I)', ...(tooltip as any) }}
      />
      <ToolbarMark
        type={getPlatePluginType(editor, MARK_UNDERLINE)}
        icon={<MdFormatUnderlined />}
        tooltip={{ content: 'Underline (⌘U)', ...(tooltip as any) }}
      />
    </BalloonToolbar>
  )
}

export const GenerateExplanationButton = ({
  insertText,
  deleteText,
  editor,
}: {
  insertText: (text: string) => void
  deleteText: (characters: number) => void
  editor: SPEditor & ReactEditor & HistoryEditor
}) => {
  const [isExplanation, setExplanation] = useState(false)
  const tempString = 'gpt-3 explanation'

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
              deleteText(tempString.length + 2)
              setExplanation(false)
            }}
          />
        </>
      )}
      <Button
        type="button"
        size="extraSmall"
        appearance="secondary"
        disabled={isExplanation}
        onClick={() => {
          insertText(tempString)
          setExplanation(true)
        }}
      >
        Generate Explanation
      </Button>
    </div>
  )
}

export const ToolbarButtons = ({
  editor,
}: {
  editor: SPEditor & ReactEditor & HistoryEditor
}) => {
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
      <div className="flex">
        <ToolbarButtonsBasicElements />
        <ToolbarButtonsList />
        {/* <ToolbarButtonsIndent /> */}
        <ToolbarButtonsBasicMarks />
        {/* <ToolbarColorPicker pluginKey={MARK_COLOR} icon={<MdFormatColorText />} />
    <ToolbarColorPicker pluginKey={MARK_BG_COLOR} icon={<MdFontDownload />} /> */}
        <ToolbarButtonsAlign />
        {/* <ToolbarLink icon={<MdLink />} /> */}
        <ToolbarImage icon={<MdImage />} />
        <ToolbarMediaEmbed icon={<MdOndemandVideo />} />
        {/* <ToolbarButtonsTable /> */}
      </div>
      <GenerateExplanationButton
        editor={editor}
        insertText={insertTextToEditor}
        deleteText={deleteTextFromEditor}
      />
    </div>
  )
}
