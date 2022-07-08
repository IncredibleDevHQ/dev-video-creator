/*  
    Function to handle updates to the view config
    These updates do not reside inside any other component to prevent rerenders
    Returns null 
*/

import { LiveObject } from '@liveblocks/client'
import { useEffect } from 'react'
import { useRecoilValue } from 'recoil'
import {
	activeFragmentIdAtom,
	astAtom,
	currentBlockSelector,
} from 'src/stores/flick.store'
import { useMap } from 'src/utils/liveblocks.config'
import { BlockProperties, CodeAnimation, CodeTheme, CodeStyle } from 'utils/src'

const ViewConfigUpdater = () => {
	const currentBlock = useRecoilValue(currentBlockSelector)
	const activeFragmentId = useRecoilValue(activeFragmentIdAtom)
	const simpleAST = useRecoilValue(astAtom)

	const viewConfig = useMap('viewConfig')
		?.get(activeFragmentId as string)
		?.toObject()

	// TODO: Use when branding is implemented
	// const updateMultipleBlockProperties = (
	// 	ids: string[],
	// 	properties: BlockProperties[]
	// ) => {
	// 	if (!viewConfig) return

	// 	// Delete configs of blocks which are not there in the editor
	// 	Object.entries(viewConfig.blocks)
	// 		.filter(x => !simpleAST?.blocks.map(b => b.id).includes(x[0]))
	// 		.forEach(a => {
	// 			viewConfig.blocks.delete(a[0])
	// 		})

	// 	for (let i = 0; i < ids.length; i += 1) {
	// 		viewConfig.blocks.set(ids[i], properties[i])
	// 	}
	// }

	useEffect(() => {
		const updateBlockProperties = (id: string, properties: BlockProperties) => {
			if (!viewConfig) return

			// Delete configs of blocks which are not there in the editor
			Array.from(viewConfig.blocks.keys())
				.filter(x => !simpleAST?.blocks.map(b => b.id).includes(x))
				.forEach(a => {
					viewConfig.blocks.delete(a)
				})

			viewConfig.blocks.set(id, new LiveObject(properties))
		}

		if (!currentBlock) return
		if (viewConfig?.blocks.has(currentBlock.id)) return

		let properties: BlockProperties = {
			layout: 'classic',
		}

		switch (currentBlock.type) {
			case 'codeBlock': {
				properties = {
					...properties,
					view: {
						type: 'codeBlock',
						code: {
							animation: CodeAnimation.TypeLines,
							theme: CodeTheme.DarkPlus,
							// TODO: After implementing theme
							// flick?.theme?.name !== 'Mux'
							// 	? CodeTheme.DarkPlus
							// 	: CodeTheme.LightPlus,
							codeStyle: CodeStyle.Editor,
							fontSize: 16,
						},
					},
				}
				break
			}
			case 'imageBlock': {
				properties = {
					...properties,
					view: {
						type: 'imageBlock',
						image: {
							captionTitleView: 'titleOnly',
						},
					},
				}
				break
			}
			case 'videoBlock': {
				properties = {
					...properties,
					view: {
						type: 'videoBlock',
						video: {
							captionTitleView: 'titleOnly',
						},
					},
				}
				break
			}
			case 'listBlock': {
				properties = {
					...properties,
					view: {
						type: 'listBlock',
						list: {
							appearance: 'stack',
							orientation: 'vertical',
							viewStyle: 'bullet',
							displayTitle: true,
						},
					},
				}
				break
			}
			case 'headingBlock': {
				properties = {
					...properties,
					view: {
						type: 'headingBlock',
					},
				}
				break
			}
			default:
				break
		}

		updateBlockProperties(currentBlock.id, properties)
	}, [currentBlock, simpleAST?.blocks, viewConfig, viewConfig?.blocks])

	return null
}

export default ViewConfigUpdater
