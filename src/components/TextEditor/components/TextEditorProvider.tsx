import React from 'react'
import { EditorState } from 'remirror'
import type { SimpleAST, Block } from '../utils'

export interface TextEditorProviderProps {
  state?: EditorState
  simpleASTCallback?: (simpleAST: SimpleAST) => void
  simpleAST?: SimpleAST
  handleActiveBlock?: (block?: Block) => void
  handleUpdatePosition?: (position?: any) => void
}

const TextEditorProvider = React.createContext<TextEditorProviderProps>(
  {} as any
)

export default TextEditorProvider
