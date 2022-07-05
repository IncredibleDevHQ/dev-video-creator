import { Extension } from '@tiptap/core'
import Suggestion, { SuggestionOptions } from '@tiptap/suggestion'

export const SlashCommands = Extension.create({
  name: 'slashCommands',

  addOptions() {
    return {
      ...this.parent?.(),
      suggestion: {
        char: '/',
        startOfLine: true,
        command: ({ editor, range, props }) => {
          props.command({ editor, range, props })
        },
      } as Partial<SuggestionOptions>,
    }
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        ...this.options.suggestion,
        editor: this.editor,
      }),
    ]
  },
})
