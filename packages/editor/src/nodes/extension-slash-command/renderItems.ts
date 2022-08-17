// Copyright (c) 2022 Pixelbyte Studio Pvt Ltd
//
// This file is part of Incredible, Pixelbyte Studio Pvt Ltd
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program\.  If not, see <http://www\.gnu\.org/licenses/>\.

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
				getReferenceClientRect: props.clientRect as any,
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
				getReferenceClientRect: props.clientRect as any,
			})
		},
		onKeyDown(props: SuggestionKeyDownProps) {
			if (props.event.key === 'Escape') {
				popup[0].hide()

				return true
			}

			if (props.event.key === 'Enter') {
				if (
					suggestionProps.items.filter(item =>
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
