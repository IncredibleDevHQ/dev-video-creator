/* eslint-disable import/no-extraneous-dependencies */
import { ReactRenderer } from '@tiptap/react'
import { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion'
import tippy, { Instance, Props } from 'tippy.js'
import { CommandsList } from './CommandsList'

const renderItems = () => {
  let component: ReactRenderer<CommandsList>
  let popup: Instance<Props>[]
  let suggestionProps: SuggestionProps

  return {
    onStart: (props: SuggestionProps) => {
      suggestionProps = props
      component = new ReactRenderer(CommandsList, {
        props,
        editor: props.editor,
      })

      popup = tippy('body', {
        getReferenceClientRect: props.clientRect,
        appendTo: () => document.body,
        content: component.element,
        showOnCreate: true,
        interactive: true,
        trigger: 'manual',
        placement: 'bottom-start',
      })
    },
    onUpdate(props: SuggestionProps) {
      suggestionProps = props
      component.updateProps(props)

      popup[0].setProps({
        getReferenceClientRect: props.clientRect,
      })
    },
    onKeyDown(props: SuggestionKeyDownProps) {
      if (props.event.key === 'Escape') {
        popup[0].hide()

        return true
      }

      if (props.event.key === 'Enter') {
        if (
          suggestionProps.items.filter((item) =>
            item.title
              .toLowerCase()
              .startsWith(suggestionProps.query.toLowerCase())
          ).length === 0
        ) {
          this.onExit()
        }
      }

      return component.ref?.onKeyDown(props) || false
    },
    onExit() {
      popup[0].destroy()
      component.destroy()
    },
  }
}

export default renderItems
