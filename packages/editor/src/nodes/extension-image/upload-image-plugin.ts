// Copyright 2022 Pixelbyte Studio Pvt Ltd
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

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
