/*
    Function to handle updates to the view config
    These updates do not reside inside any other component to prevent rerenders
    Returns null
*/

import { LiveObject } from '@liveblocks/client'
import { useEffect, useMemo } from 'react'
import { useRecoilValue } from 'recoil'
import {
	activeFragmentIdAtom,
	astAtom,
	currentBlockSelector,
} from 'src/stores/flick.store'
import { brandingAtom, themeAtom } from 'src/stores/studio.store'
import { loadFonts } from 'src/utils/hooks/useLoadFont'
import { useMap } from 'src/utils/liveblocks.config'
import {
	BlockProperties,
	CodeAnimation,
	CodeStyle,
	CodeTheme,
	IntroBlockView,
	OutroBlockView,
} from 'utils/src'

const ViewConfigUpdater = () => {
	const currentBlock = useRecoilValue(currentBlockSelector)
	const activeFragmentId = useRecoilValue(activeFragmentIdAtom)
	const simpleAST = useRecoilValue(astAtom)
	const theme = useRecoilValue(themeAtom)
	const branding = useRecoilValue(brandingAtom)

	const viewConfig = useMap('viewConfig')
		?.get(activeFragmentId as string)
		?.toObject()

	const payload = useMap('payload')

	useMemo(() => {
		if (branding?.font)
			loadFonts([
				{
					family: branding?.font?.heading?.family as string,
					weights: ['400'],
					type: branding?.font?.heading?.type ?? 'google',
					url: branding?.font?.heading?.url,
				},
				{
					family: branding?.font?.body?.family as string,
					weights: ['400'],
					type: branding?.font?.body?.type ?? 'google',
					url: branding?.font?.body?.url,
				},
			])
	}, [branding?.font])

	useEffect(() => {
		const updateMultipleBlockProperties = (
			ids: string[],
			properties: BlockProperties[]
		) => {
			if (!viewConfig) return

			// Delete configs of blocks which are not there in the editor
			Object.entries(viewConfig.blocks)
				.filter(x => !simpleAST?.blocks.map(b => b.id).includes(x[0]))
				.forEach(a => {
					viewConfig.blocks.delete(a[0])
				})

			for (let i = 0; i < ids.length; i += 1) {
				viewConfig.blocks.set(ids[i], properties[i])
			}
		}

		const intro = simpleAST?.blocks.find(b => b.type === 'introBlock')
		const outro = simpleAST?.blocks.find(b => b.type === 'outroBlock')
		if (!intro || !outro || !viewConfig) return
		const introView = viewConfig.blocks?.get(intro?.id)?.view as IntroBlockView
		const outroView = viewConfig.blocks?.get(outro?.id)?.view as OutroBlockView
		if (!branding) {
			updateMultipleBlockProperties(
				[intro.id, outro.id],
				[
					{
						view: {
							...introView,
							intro: {
								...introView?.intro,
								order: introView?.intro?.order?.filter(
									i => i.state !== 'introVideo'
								),
							},
						},
					},
					{
						view: {
							...outroView,
							outro: {
								...outroView?.outro,
								order: outroView?.outro?.order?.filter(
									i => i.state !== 'outroVideo'
								),
							},
						},
					},
				]
			)
		} else {
			updateMultipleBlockProperties(
				[intro.id, outro.id],
				[
					{
						view: {
							...introView,
							intro: {
								...introView?.intro,
								order: branding?.introVideoUrl
									? [
											...(introView?.intro?.order || []),
											{ enabled: true, state: 'introVideo' },
									  ]
									: introView?.intro?.order?.filter(
											i => i.state !== 'introVideo'
									  ),
							},
						},
					},
					{
						view: {
							...outroView,
							outro: {
								...outroView?.outro,
								order: branding?.outroVideoUrl
									? [
											...(outroView?.outro?.order || []),
											{ enabled: true, state: 'outroVideo' },
									  ]
									: outroView?.outro?.order?.filter(
											i => i.state !== 'outroVideo'
									  ),
							},
						},
					},
				]
			)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [branding])

	useEffect(() => {
		const updateBlockProperties = (id: string, properties: BlockProperties) => {
			if (!viewConfig) return

			// Delete configs of blocks which are not there in the editor
			Array.from(viewConfig.blocks.keys())
				.filter(x => !simpleAST?.blocks.map(b => b.id).includes(x))
				.forEach(a => {
					viewConfig.blocks.delete(a)
				})

			viewConfig.blocks.set(id, properties)
			payload?.set(id, new LiveObject({}))
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
							theme:
								theme?.name !== 'Mux'
									? CodeTheme.DarkPlus
									: CodeTheme.LightPlus,
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
	}, [
		currentBlock,
		payload,
		simpleAST?.blocks,
		viewConfig,
		viewConfig?.blocks,
		theme,
	])

	return null
}

export default ViewConfigUpdater
