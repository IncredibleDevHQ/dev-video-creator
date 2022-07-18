import { css, cx } from '@emotion/css'
import { useEffect, useState } from 'react'
import { BiNote } from 'react-icons/bi'
import { CgProfile } from 'react-icons/cg'
import { FiCode, FiLayout } from 'react-icons/fi'
import { IoArrowDownOutline, IoArrowUpOutline, IoPlayForwardOutline, IoSparklesOutline } from 'react-icons/io5'
import { MdOutlineTextFields } from 'react-icons/md'
import useMeasure from 'react-use-measure'
import { useRecoilState, useRecoilValue } from 'recoil'
import {
	activeFragmentIdAtom,
	astAtom,
	currentBlockSelector,
	flickAtom,
  openStudioAtom,
} from 'src/stores/flick.store'
import { codePreviewStore } from 'src/stores/studio.store'
import useBlock from 'src/utils/hooks/useBlock'
import { useMap } from 'src/utils/liveblocks.config'
import { Text } from 'ui/src'
import {
	allLayoutTypes,
	BlockProperties,
	BlockView,
	CodeBlockView,
	IntroBlockView,
	Layout,
	OutroBlockView,
} from 'utils/src'
import CanvasComponent from '../canvas/CanvasComponent'
import { CodeAnimateTab, CodeTextSizeTab } from './CodePreview'
import { IntroContentTab, IntroSequenceTab, PictureTab } from './IntroPreview'
import LayoutSelector from './LayoutSelector'
import ModeSelector from './mode'
import { codeThemeConfig, getSurfaceColor } from './mode/CodeBlockMode'
import Note from './Notes'
import { OutroContentTab, OutroSequenceTab } from './OutroPreview'

const noScrollBar = css`
	::-webkit-scrollbar {
		display: none;
	}
`

interface Tab {
	name: string
	id: string
	// Icon: IconType | HTMLElement
}

const commonTabs: Tab[] = [
	{
		id: 'Layout',
		name: 'Layout',
	},
	{
		id: 'Mode',
		name: 'Mode',
	},
	{
		id: 'Note',
		name: 'Note',
	},
]

const codeBlockTabs: Tab[] = [
	{
		id: 'TextSize',
		name: 'Text size',
	},
	{
		id: 'Animate',
		name: 'Animate',
	},
]

const introOutroBlockTabs: Tab[] = [
	{
		id: 'Content',
		name: 'Content',
	},
	{
		id: 'Sequence',
		name: 'Sequence',
	},
]

const introBlockTabs: Tab[] = [
	{
		id: 'Picture',
		name: 'Picture',
	},
]

const getIcon = (tab: Tab, block?: BlockProperties) => {
	switch (tab.id) {
		case 'Layout':
			return <FiLayout size={18} />
		case 'Mode':
			if (block && block.view?.type !== 'codeBlock')
				return <IoSparklesOutline size={18} />
			return (
				<div
					className='rounded-sm border'
					style={{
						backgroundColor:
							block?.view?.type === 'codeBlock'
								? getSurfaceColor({ codeTheme: block.view.code.theme })
								: '#fff',
					}}
				>
					<FiCode
						className='m-1'
						style={{
							color:
								block?.view?.type === 'codeBlock'
									? codeThemeConfig.find(
											themeConfig =>
												themeConfig.theme ===
												(block.view as CodeBlockView).code.theme
									  )?.textColor
									: '#fff',
						}}
					/>
				</div>
			)
		case 'Note':
			return <BiNote size={18} />
		case 'TextSize':
			return <MdOutlineTextFields size={18} />
		case 'Animate':
			return <IoSparklesOutline size={18} />
		case 'Content':
			return <MdOutlineTextFields size={18} />
		case 'Picture':
			return <CgProfile size={18} />
		case 'Sequence':
			return <IoPlayForwardOutline size={18} />
		default:
			return <IoSparklesOutline size={18} />
	}
}

const Preview = ({ centered }: { centered: boolean }) => {
	const flickId = useRecoilValue(flickAtom)?.id
	const activeFragmentId = useRecoilValue(activeFragmentIdAtom)
  const openStudio = useRecoilValue(openStudioAtom)

	const config = useMap('viewConfig')
		?.get(activeFragmentId as string)
		?.toObject()

	const [block, setBlock] = useRecoilState(currentBlockSelector)
	const { blockProperties, updateBlockProperties } = useBlock(
		activeFragmentId as string,
		block?.id as string
	)

	const blocks = useRecoilValue(astAtom)?.blocks
	useEffect(() => {
		if (!block) {
			setBlock(blocks?.[0])
		}
	}, [block, blocks, setBlock])

	const [tabs, setTabs] = useState<Tab[]>(commonTabs)
	const [activeTab, setActiveTab] = useState<Tab>(commonTabs[0])

  const [codePreviewValue, setCodePreviewValue] =
		useRecoilState(codePreviewStore)

	const [ref, bounds] = useMeasure()

	// TODO: Key down listener

	useEffect(() => {
		if (!block) return
		const { type } = block
		if (type !== 'introBlock' && type !== 'outroBlock')
			setActiveTab(commonTabs[0])
		switch (type) {
			case 'introBlock': {
				if (config?.mode === 'Landscape') {
					setTabs([
						commonTabs[0],
						...introOutroBlockTabs,
						...introBlockTabs,
						commonTabs[2],
					])
				} else {
					setTabs([...introOutroBlockTabs, ...introBlockTabs, commonTabs[2]])
				}
				setActiveTab(introOutroBlockTabs[0])
				break
			}
			case 'outroBlock':
				setTabs([commonTabs[0], ...introOutroBlockTabs, commonTabs[2]])
				setActiveTab(commonTabs[0])
				break
			case 'codeBlock': {
				setTabs([commonTabs[0], commonTabs[1], ...codeBlockTabs, commonTabs[2]])
        setCodePreviewValue(0)
				break
			}
			case 'headingBlock':
				setTabs([commonTabs[0], commonTabs[2]])
				break
			default:
				setTabs(commonTabs)
				break
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [block?.id, config?.mode])

	if (!block) return null

	return (
		<div className='flex justify-between flex-1 overflow-hidden'>
			<div
				className={cx(
					'flex justify-center items-start bg-gray-100 flex-1 pl-0',
					{
						'items-center -mt-8': centered,
						'pt-12': !centered,
					}
				)}
				ref={ref}
			>
				<div className='flex items-center relative'>
					{!openStudio && (
						<CanvasComponent
							bounds={bounds}
							dataConfig={[block]}
							viewConfig={{
								mode: config?.mode || 'Landscape',
								speakers: config?.speakers || [],
								selectedBlocks: config?.selectedBlocks || [],
								continuousRecording: config?.continuousRecording || false,
								blocks: {
									[block.id]: blockProperties || {},
								},
							}}
							isPreview
							flickId={flickId as string}
							scale={0.83}
						/>
					)}
					{block.type === 'codeBlock' && (
						<div className='absolute bottom-0 right-8 -mb-4'>
							<button
								className={cx(
									'bg-gray-800 border border-gray-200 text-white p-1.5 rounded-sm'
								)}
								type='button'
								onClick={() => {
									setCodePreviewValue?.(
										codePreviewValue ? codePreviewValue - 1 : 0
									)
								}}
							>
								<IoArrowUpOutline
									style={{
										margin: '3px',
									}}
									className='w-4 h-4 p-px'
								/>
							</button>
							<button
								className={cx(
									'bg-gray-800 border border-gray-200 text-white p-1.5 rounded-sm ml-2'
								)}
								type='button'
								onClick={() => {
									setCodePreviewValue?.(codePreviewValue + 1)
								}}
							>
								<IoArrowDownOutline
									style={{
										margin: '3px',
									}}
									className='w-4 h-4 p-px'
								/>
							</button>
						</div>
					)}
				</div>
			</div>
			{block.type !== 'interactionBlock' && (
				<div className='flex w-[350px]'>
					<div
						className={cx(
							'bg-white w-64 flex-1 overflow-y-scroll',
							noScrollBar
						)}
					>
						{activeTab.id === introOutroBlockTabs[0].id && (
							<div>
								{block.type === 'introBlock' && (
									<IntroContentTab
										view={blockProperties?.view as IntroBlockView}
										updateView={(view: IntroBlockView) => {
											updateBlockProperties({
												...blockProperties,
												view,
											})
										}}
									/>
								)}
								{block.type === 'outroBlock' && (
									<OutroContentTab
										view={blockProperties?.view as OutroBlockView}
										updateView={(view: OutroBlockView) => {
											updateBlockProperties({
												...blockProperties,
												view,
											})
										}}
									/>
								)}
							</div>
						)}

						{activeTab.id === introBlockTabs[0].id && (
							<PictureTab
								view={blockProperties?.view as IntroBlockView}
								updateView={(view: IntroBlockView) => {
									updateBlockProperties({
										...blockProperties,
										view,
									})
								}}
							/>
						)}

						{activeTab.id === introOutroBlockTabs[1].id &&
							block.type === 'introBlock' && (
								<IntroSequenceTab
									view={blockProperties?.view as IntroBlockView}
									updateView={(view: IntroBlockView) => {
										updateBlockProperties({
											...blockProperties,
											view,
										})
									}}
								/>
							)}

						{activeTab.id === introOutroBlockTabs[1].id &&
							block.type === 'outroBlock' && (
								<OutroSequenceTab
									view={blockProperties?.view as OutroBlockView}
									updateView={(view: OutroBlockView) => {
										updateBlockProperties({
											...blockProperties,
											view,
										})
									}}
								/>
							)}
						{activeTab.id === commonTabs[0].id && (
							<LayoutSelector
								mode={config?.mode || 'Landscape'}
								layout={blockProperties?.layout || allLayoutTypes[0]}
								updateLayout={(layout: Layout) => {
									updateBlockProperties({
										...blockProperties,
										layout,
									})
								}}
								type={block.type}
							/>
						)}
						{activeTab.id === commonTabs[1].id && (
							<ModeSelector
								view={blockProperties?.view}
								updateView={(view: BlockView) => {
									updateBlockProperties({
										...blockProperties,
										view,
									})
								}}
							/>
						)}
						{activeTab.id === commonTabs[2].id && <Note block={block} />}
						{activeTab.id === codeBlockTabs[0].id &&
							block.type === 'codeBlock' && (
								<CodeTextSizeTab
									view={blockProperties?.view as CodeBlockView}
									updateView={(view: CodeBlockView) => {
										updateBlockProperties({
											...blockProperties,
											view,
										})
									}}
								/>
							)}
						{activeTab.id === codeBlockTabs[1].id &&
							block.type === 'codeBlock' && (
								<CodeAnimateTab
									view={blockProperties?.view as CodeBlockView}
									updateView={(view: CodeBlockView) => {
										updateBlockProperties({
											...blockProperties,
											view,
										})
									}}
								/>
							)}
					</div>
					<div className='flex flex-col bg-gray-50 px-2 pt-4 gap-y-2 relative w-[88px]'>
						{tabs
							.filter(tab => {
								if (
									(block.type === 'outroBlock' ||
										block.type === 'introBlock') &&
									tab.id === commonTabs[1].id
								)
									return false

								return true
							})
							.map(tab => (
								<button
									type='button'
									onClick={() => setActiveTab(tab)}
									className={cx(
										'flex flex-col items-center bg-transparent py-3 px-2 rounded-md text-gray-500 gap-y-2 transition-all',
										{
											'!bg-gray-200 !text-gray-800': activeTab.id === tab.id,
											'hover:bg-gray-100': activeTab.id !== tab.id,
										}
									)}
									key={tab.id}
								>
									{getIcon(tab, blockProperties)}
									<Text textStyle='bodySmall'>{tab.name}</Text>
								</button>
							))}
					</div>
				</div>
			)}
		</div>
	)
}

export default Preview
