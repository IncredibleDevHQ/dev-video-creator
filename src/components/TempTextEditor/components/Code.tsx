import React from 'react'
import { BiTrashAlt } from 'react-icons/bi'
import Editor from '@monaco-editor/react'
import { BlockComponentContext, TabItem } from '.'
import { CodeBlockProps } from '../types'
import theme from './theme'
import languages from './languages'

const Code = () => {
  const { block, handleUpdateBlock } = React.useContext(BlockComponentContext)

  const handleEditorDidMount = (editor: any, monaco: any) => {
    monaco.editor.defineTheme('theme', theme)
  }

  const handleDelete = () => {
    const candidateBlock = { ...block } as CodeBlockProps

    if (candidateBlock.codeBlock) {
      // @ts-ignore
      candidateBlock.codeBlock = undefined
    }

    if (candidateBlock) {
      // @ts-ignore
      candidateBlock.type = undefined
    }

    handleUpdateBlock?.(candidateBlock)
  }

  return (
    <div className="border-2 rounded relative">
      <Editor
        onChange={(value) => {
          const candidateBlock = { ...block } as CodeBlockProps
          candidateBlock.codeBlock.code = value

          handleUpdateBlock?.(candidateBlock)
        }}
        onMount={handleEditorDidMount}
        height="200px"
        language={
          (block as CodeBlockProps)?.codeBlock?.language || 'typescript'
        }
        value={(block as CodeBlockProps)?.codeBlock?.code}
        defaultLanguage="typescript"
        theme="theme"
        options={{
          minimap: {
            enabled: false,
          },
          fontSize: 14,
          wordWrap: 'on',
        }}
      />
      <div className="absolute top-4 grid grid-flow-col gap-x-2 right-4 p-1 rounded">
        <select
          className="bg-gray-200 hover:bg-gray-300 transition-colors p-1 focus:outline-none rounded"
          onChange={(e) => {
            const candidateBlock = { ...block } as CodeBlockProps
            candidateBlock.codeBlock.language = e.target.value

            handleUpdateBlock?.(candidateBlock)
          }}
          defaultValue="typescript"
          value={(block as CodeBlockProps)?.codeBlock?.language}
        >
          {languages.map((language) => (
            <option key={language.value} value={language.value}>
              {language.name}
            </option>
          ))}
        </select>
        <TabItem
          label="Delete"
          icon={BiTrashAlt}
          appearance="icon"
          handleClick={handleDelete}
        />
      </div>
    </div>
  )
}

export default Code
