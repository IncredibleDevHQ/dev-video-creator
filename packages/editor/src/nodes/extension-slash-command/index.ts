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

import { Extension } from '@tiptap/core'
import Suggestion, { SuggestionOptions } from '@tiptap/suggestion'

export default Extension.create({
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
