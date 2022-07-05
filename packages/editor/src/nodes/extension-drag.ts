/* eslint-disable no-unsafe-optional-chaining */
/* eslint-disable no-param-reassign */
/* eslint-disable prefer-const */
import { Extension } from '@tiptap/core'
import { NodeSelection, Plugin, PluginKey } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'

// FIXME this is a temporary workaround for drag handles
export default (dragHandle: HTMLDivElement | null) =>
	Extension.create({
		name: 'dragHandler',

		addProseMirrorPlugins() {
			let nodeToBeDragged: any = null
			const WIDTH = 56
			const HANDLER_GAP = 50
			const dragHandler =
				dragHandle ||
				document.getElementById('drag-handle') ||
				document.createElement('div')
			dragHandler.style.visibility = 'hidden'
			dragHandler.style.display = 'hidden'
			dragHandler.setAttribute('draggable', 'true')
			dragHandler.style.width = `${WIDTH}px`
			dragHandler.style.position = 'absolute'
			const { editor } = this

			function createRect(
				rect: { left: number; top: number; width: any; height: any } | null
			) {
				if (rect == null) {
					return null
				}
				let newRect = {
					left: rect.left + document.body.scrollLeft,
					top: rect.top + document.body.scrollTop,
					width: rect.width,
					height: rect.height,
					bottom: 0,
					right: 0,
				}
				newRect.bottom = newRect.top + newRect.height
				newRect.right = newRect.left + newRect.width
				return newRect
			}

			function removeNode(node: Node) {
				if (node && node.parentNode) {
					node.parentNode.removeChild(node)
				}
			}

			// Get the direct child of the Editor. To cover cases when the user is hovering nested nodes.
			function getDirectChild(node: Node | null | undefined) {
				while (node && node.parentNode) {
					if (
						node.firstChild?.parentElement?.classList?.contains(
							'ProseMirror'
						) ||
						node.parentElement?.classList?.contains('ProseMirror')
					) {
						break
					}
					node = node.parentNode
				}
				return node
			}

			function blockPosAtCoords(
				coords: {
					left: number
					top: number
				},
				view: any
			) {
				let pos = view.posAtCoords(coords)
				if (pos) {
					let node = getDirectChild(view.nodeDOM(pos.inside))
					if (node && node.nodeType === 1) {
						let desc = view.docView.nearestDesc(node, true)
						if (!(!desc || desc === view.docView)) {
							return desc.posBefore
						}
					}
				}
				return null
			}

			function dragStart(e: DragEvent, view: EditorView) {
				if (!e.dataTransfer) return
				let coords = { left: e.clientX + HANDLER_GAP, top: e.clientY }
				let pos = blockPosAtCoords(coords, view)
				if (pos != null) {
					view.dispatch(
						view.state.tr.setSelection(
							NodeSelection.create(view.state.doc, pos)
						)
					)
					let slice = view.state.selection.content()
					e.dataTransfer.clearData()
					e.dataTransfer.setDragImage(nodeToBeDragged, 10, 10)
					view.dragging = { slice, move: true }
				}
			}

			// Check if node has content. If not, the handler don't need to be shown.
			function nodeHasContent(view: EditorView, inside: number): boolean {
				return true // return true for now
				return !!view.nodeDOM(inside)?.textContent
			}

			function bindEventsToDragHandler(editorView: any) {
				dragHandler.setAttribute('draggable', 'true')
				dragHandler.addEventListener('dragstart', e => dragStart(e, editorView))
				dragHandler.firstChild?.addEventListener('click', (e: any) => {
					let coords = { left: e.clientX + HANDLER_GAP, top: e.clientY }
					let pos = blockPosAtCoords(coords, editorView)
					if (pos != null) {
						// get node at position
						let node = editorView.state.doc.nodeAt(pos)

						// insert paragraph with content "/" after current block in the editor
						const text = '/'
						const textNode = editorView.state.schema.text(text)
						const paragraphNode =
							editorView.state.schema.nodes.paragraph.create(null, textNode)

						if (node?.type.name === 'paragraph' && node?.textContent === '') {
							editorView.dispatch(editorView.state.tr.insertText('/', pos + 1))
							editor.commands.focus(pos + 2)
						} else {
							editorView.dispatch(
								editorView.state.tr.insert(
									pos + node?.nodeSize || 0,
									paragraphNode
								)
							)
							editor.commands.focus(pos + node?.nodeSize + 2 || 0)
						}
					}
				})
				document.body.appendChild(dragHandler)
			}

			return [
				new Plugin({
					key: new PluginKey('dragHandler'),
					view: editorView => {
						bindEventsToDragHandler(editorView)
						return {
							destroy() {
								removeNode(dragHandler)
							},
						}
					},
					props: {
						handleDOMEvents: {
							drop(_, event: any) {
								setTimeout(() => {
									let node = document.querySelector(
										'.ProseMirror-hideselection'
									)
									if (node) {
										node.classList.remove('ProseMirror-hideselection')
									}
								})
								event.stopPropagation()
								return false
							},
							mousemove(view: any, event: any) {
								let coords = {
									left: event.clientX + HANDLER_GAP,
									top: event.clientY,
								}
								const position = view.posAtCoords(coords)
								if (position && nodeHasContent(view, position.inside)) {
									nodeToBeDragged = getDirectChild(
										view.nodeDOM(position.inside)
									)
									if (
										nodeToBeDragged &&
										!nodeToBeDragged.classList?.contains('ProseMirror')
									) {
										let rect = createRect(
											nodeToBeDragged.getBoundingClientRect()
										)
										let win = nodeToBeDragged.ownerDocument.defaultView
										if (rect) {
											rect.top += win.pageYOffset
											rect.left += win.pageXOffset
											dragHandler.style.left = `${rect.left - WIDTH}px`
											dragHandler.style.top = `${rect.top - 2}px`
											dragHandler.style.visibility = 'visible'
											dragHandler.style.display = 'flex'
										}
									} else {
										dragHandler.style.visibility = 'hidden'
										dragHandler.style.display = 'hidden'
									}
								} else {
									nodeToBeDragged = null
									dragHandler.style.visibility = 'hidden'
									dragHandler.style.display = 'hidden'
								}
								return true
							},
							// hide handle on keydown
							keydown() {
								setTimeout(() => {
									dragHandler.style.visibility = 'hidden'
									dragHandler.style.display = 'hidden'
								}, 250)
								return false
							},
						},
					},
				}),
			]
		},
	})
