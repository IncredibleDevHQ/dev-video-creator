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

import { Plugin } from 'prosemirror-state'

export const uploadImagePlugin = () =>
	new Plugin({
		props: {
			handlePaste(view, event) {
				const items = Array.from(event.clipboardData?.items || [])
				const { schema } = view.state

				items.forEach(item => {
					const image = item.getAsFile()

					if (item.type.indexOf('image') === 0) {
						event.preventDefault()
						if (!image) return

						const reader = new FileReader()
						reader.onload = readerEvent => {
							const node = schema.nodes.upload.create({
								uri: readerEvent.target?.result,
								type: 'image',
							})
							const transaction = view.state.tr.replaceSelectionWith(node)
							view.dispatch(transaction)
						}
						reader.readAsDataURL(image)
					} else {
						const reader = new FileReader()
						reader.onload = readerEvent => {
							const node = schema.nodes.image.create({
								src: readerEvent.target?.result,
							})
							const transaction = view.state.tr.replaceSelectionWith(node)
							view.dispatch(transaction)
						}
						if (!image) return
						reader.readAsDataURL(image)
					}
				})

				return false
			},
			handleDOMEvents: {
				drop(view: any, event: any) {
					const hasFiles = event.dataTransfer?.files?.length

					if (!hasFiles) {
						return false
					}

					const images = Array.from(event?.dataTransfer?.files).filter(
						(file: any) => /image/i.test(file.type)
					)

					if (images.length === 0) {
						return false
					}

					event.preventDefault()

					const { schema } = view.state
					const coordinates = view.posAtCoords({
						left: event.clientX,
						top: event.clientY,
					})

					if (!coordinates) return false

					images.forEach(async (image: any) => {
						const reader = new FileReader()
						reader.onload = readerEvent => {
							const node = schema.nodes.upload.create({
								uri: readerEvent.target?.result,
								type: 'image',
							})
							const transaction = view.state.tr.insert(coordinates.pos, node)
							view.dispatch(transaction)
						}
						reader.readAsDataURL(image)
					})
					return false
				},
			},
		},
	})
