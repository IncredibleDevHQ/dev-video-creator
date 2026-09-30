// What a harness tool call does, from its name: reading a manual is not
// writing a page. Unknown tools are reported as tool use, never as a write.
import type { HarnessOperation } from './types'

const OPERATIONS: Array<[HarnessOperation, RegExp]> = [
  ['read', /^(?:read|readfile|read_file|view|cat|ls|list|listdir|list_directory|notebookread)$/i],
  ['search', /^(?:glob|grep|search|find|searchfiles|search_files|websearch|webfetch)$/i],
  ['write', /^(?:write|writefile|write_file|create|createfile|create_file)$/i],
  ['edit', /^(?:edit|multiedit|str_replace|strreplacefile|str_replace_file|patch|apply_patch|notebookedit)$/i],
  ['run', /^(?:bash|shell|run|exec|command|terminal|runcommand|run_command)$/i],
]

export const operationOf = (tool: string): HarnessOperation => {
  const name = tool.replace(/^mcp__[^_]+__/, '')
  if (/^mcp__/.test(tool)) return 'tool'
  for (const [operation, pattern] of OPERATIONS) if (pattern.test(name)) return operation
  return 'tool'
}
