/*
    Function to handle updates to the view config
    These updates do not reside inside any other component to prevent rerenders
    Returns null
*/

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRecoilValue } from 'recoil'
import {
	activeFragmentIdAtom,
	astAtom,
	currentBlockSelector,
} from 'src/stores/flick.store'
import { brandingAtom, themeAtom } from 'src/stores/studio.store'
import { loadFonts } from 'src/utils/hooks/useLoadFont'
import { useMap, useRoom } from 'src/utils/liveblocks.config'
import {
	BlockProperties,
	CodeAnimation,
	CodeStyle,
	CodeTheme,
	IntroBlockView,
	LiveViewConfig,
	OutroBlockView,
} from 'utils/src'

const ViewConfigUpdater = () => {
	const currentBlock = useRecoilValue(currentBlockSelector)
	const activeFragmentId = useRecoilValue(activeFragmentIdAtom)
	const simpleAST = useRecoilValue(astAtom)
	const theme = useRecoilValue(themeAtom)
	const branding = useRecoilValue(brandingAtom)

	const room = useRoom()
	const config = useMap('viewConfig')?.get(activeFragmentId as string)
	const [viewConfig, setViewConfig] = useState<LiveViewConfig>()

	useEffect(() => {
		if (!config) return
		setViewConfig({
			...config.toObject(),
		})
	}, [config])

	useEffect(() => {
		let unsubscribe: any
		if (config && !unsubscribe) {
			unsubscribe = room.subscribe(
				config,
				() => {
					setViewConfig({
						...config.toObject(),
					})
				},
				{ isDeep: true }
			)
		}
		return () => {
			unsubscribe?.()
		}
	}, [config, room])

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

	const updateSelectedBlocks = useCallback(
		(id: string) => {
			// return if its not continuous recording, or if there is 0/1 block selected
			if (
				!viewConfig?.continuousRecording ||
				!viewConfig?.selectedBlocks ||
				viewConfig?.selectedBlocks.length === 1 ||
				!simpleAST
			)
				return

			const position = simpleAST?.blocks.findIndex(b => b.id === id)
			if (position === -1) return

			const selectedBlocks = viewConfig.selectedBlocks.map(b => b.blockId)
			const blocks: {
				blockId: string
				pos: number
			}[] = []

			simpleAST.blocks.forEach((b, i) => {
				if (selectedBlocks.includes(b.id)) {
					blocks.push({ blockId: b.id, pos: i })
				}
			})

			// blocks are sorted by position
			blocks.sort((a, b) => a.pos - b.pos)

			const firstBlock = blocks[0]
			const lastBlock = blocks[blocks.length - 1]

			const firstBlockPosition = simpleAST.blocks.findIndex(
				b => b.id === firstBlock.blockId
			)
			const lastBlockPosition = simpleAST.blocks.findIndex(
				b => b.id === lastBlock.blockId
			)

			if (position > firstBlockPosition && position < lastBlockPosition) {
				const newSelectedBlocks = simpleAST.blocks
					.slice(firstBlockPosition, lastBlockPosition + 1)
					.map(b => ({ blockId: b.id, pos: b.pos }))
				config?.set('selectedBlocks', newSelectedBlocks)
			}
		},
		[
			simpleAST?.blocks,
			viewConfig?.selectedBlocks,
			viewConfig?.continuousRecording,
		]
	)

	const updateBlockProperties = useCallback(
		(id: string, properties: BlockProperties) => {
			if (!viewConfig) return

			// Delete configs of blocks which are not there in the editor
			Array.from(viewConfig.blocks.keys())
				.filter(x => !simpleAST?.blocks.map(b => b.id).includes(x))
				.forEach(a => {
					viewConfig.blocks.delete(a)
				})

			viewConfig.blocks.set(id, properties)
			updateSelectedBlocks(id)
		},
		[simpleAST?.blocks, viewConfig?.blocks, viewConfig]
	)

	useEffect(() => {
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
								theme?.name !== 'CherryBlossom'
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
	}, [currentBlock, viewConfig, viewConfig?.blocks, theme])

	return null
}

export default ViewConfigUpdater
