import { cx } from '@emotion/css'
import { useIncredibleEditor } from 'editor/src'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import { BsCloudCheck } from 'react-icons/bs'
import { IoImageOutline, IoWarningOutline } from 'react-icons/io5'
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil'
import {
	activeFragmentIdAtom,
	openStudioAtom,
	View,
	viewAtom,
} from 'src/stores/flick.store'
import {
	PresencePage,
	useMap,
	useRoom,
	useUpdateMyPresence,
} from 'src/utils/liveblocks.config'
import { Button, Switch, Text } from 'ui/src'
import { LiveViewConfig } from 'utils/src'
import Brand from './Brand'
import FormatSelector from './FormatSelector'
import Publish from './Publish'
import Theme from './Theme'
import ThumbnailModal from './ThumbnailModal'
import Transition from './Transition'

const AutoSave = () => {
	const { editorSaved, providerWebsocketState } = useIncredibleEditor()
	const [connectionState, setConnectionState] = useState<string>()

	const room = useRoom()

	useEffect(() => {
		const unsubscribe = room.subscribe('connection', status => {
			setConnectionState(status)
		})

		return () => {
			unsubscribe()
		}
	}, [room])

	const isSaved = useMemo(() => {
		if (
			!editorSaved ||
			connectionState !== 'open' ||
			providerWebsocketState !== 'connected'
		)
			return false
		return true
	}, [editorSaved, connectionState, providerWebsocketState])

	useEffect(() => {
		const saveWarningHandler = (e: any) => {
			const confirmationMessage =
				'It looks like you have been editing something. ' +
				'If you leave before saving, your changes will be lost.'

			;(e || window.event).returnValue = confirmationMessage
			return confirmationMessage
		}

		if (isSaved) window.onbeforeunload = null
		else window.onbeforeunload = saveWarningHandler
	}, [isSaved])

	return (
		<div className='flex items-center gap-x-2 text-gray-400'>
			{isSaved && (
				<>
					<BsCloudCheck />
					<Text textStyle='bodySmall'>Saved</Text>
				</>
			)}
			{!isSaved && (
				<>
					<IoWarningOutline />
					<Text textStyle='bodySmall'>Unsaved changes</Text>
				</>
			)}
		</div>
	)
}

const ViewSwitch = (): JSX.Element => {
	const [view, setView] = useRecoilState(viewAtom)

	return (
		<div className='flex items-center gap-x-4'>
			<Button
				appearance='none'
				className={cx({
					'text-dark-title': view === View.Notebook,
					'text-dark-title-200': view !== View.Notebook,
				})}
				onClick={() => setView(View.Notebook)}
			>
				Notebook
			</Button>
			<Button
				appearance='none'
				className={cx({
					'text-dark-title': view === View.Preview,
					'text-dark-title-200': view !== View.Preview,
				})}
				onClick={() => setView(View.Preview)}
			>
				Preview
			</Button>
		</div>
	)
}

const RecordButton = () => {
	const activeFragmentId = useRecoilValue(activeFragmentIdAtom)
	const room = useRoom()
	const config = useMap('viewConfig')?.get(activeFragmentId as string)
	const [viewConfig, setViewConfig] = useState<LiveViewConfig>()
	const { query } = useRouter()

	const setOpenStudio = useSetRecoilState(openStudioAtom)
	const updateMyPresence = useUpdateMyPresence()

	useEffect(() => {
		if (query.openStudio === 'true') {
			setOpenStudio(true)
		}
	}, [query.openStudio])

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

	const handleContinuousToggle = () => {
		config?.set('continuousRecording', !viewConfig?.continuousRecording)
		config?.set(
			'selectedBlocks',
			viewConfig?.continuousRecording ? viewConfig?.selectedBlocks : []
		)
	}

	return (
		<>
			<div
				role='button'
				tabIndex={0}
				className='bg-dark-100 px-2 py-1.5 rounded-sm active:scale-95 transition-all cursor-pointer'
				onKeyDown={e => {
					if (e.key === 'Enter') handleContinuousToggle()
				}}
				onClick={handleContinuousToggle}
			>
				<Switch
					label='Continuous recording'
					checked={viewConfig?.continuousRecording ?? false}
					labelClassName='text-white !text-size-xs cursor-pointer'
					onChange={() => {}}
				/>
			</div>

			<Button
				className='text-dark-title'
				disabled={
					viewConfig?.continuousRecording &&
					viewConfig.selectedBlocks.length < 1
				}
				onClick={() => {
					setOpenStudio(true)
					updateMyPresence({
						page: PresencePage.Backstage,
					})
				}}
			>
				{viewConfig?.continuousRecording && viewConfig.selectedBlocks.length < 1
					? 'Select blocks to record'
					: 'Record'}
			</Button>
		</>
	)
}

const SubHeader = (): JSX.Element => {
	const [thumbnailModal, setThumbnailModal] = useState(false)
	const [publishModal, setPublishModal] = useState(false)
	const activeFragmentId = useRecoilValue(activeFragmentIdAtom)

	return (
		<div className='flex h-12 flex-row justify-between bg-gray-800 px-5'>
			<div className='flex items-center gap-x-4'>
				<FormatSelector />
				{activeFragmentId && <ViewSwitch />}
			</div>
			<div className='flex h-full items-center'>
				<div className='mr-4'>
					<AutoSave />
				</div>
				<div className='flex h-full items-center gap-x-2 border-l border-gray-700 pl-2'>
					<Theme />
					<Brand />
					<Transition />
				</div>

				{activeFragmentId && (
					<div className='flex h-full items-center gap-x-2 border-l border-gray-700 px-2 ml-2'>
						<Button
							leftIcon={<IoImageOutline className='h-4 w-4' />}
							appearance='none'
							className='text-dark-title hover:bg-white/10 !px-2 transform active:scale-95'
							onClick={() => setThumbnailModal(true)}
						>
							Thumbnail
						</Button>
					</div>
				)}

				{activeFragmentId && (
					<div className='flex h-full items-center gap-x-2 border-l border-gray-700 pl-3'>
						<Button
							colorScheme='dark'
							className='text-dark-title'
							onClick={() => setPublishModal(true)}
						>
							Publish
						</Button>
						<RecordButton />
					</div>
				)}
			</div>
			{thumbnailModal && (
				<ThumbnailModal
					open={thumbnailModal}
					handleClose={() => setThumbnailModal(false)}
				/>
			)}
			{publishModal && (
				<Publish
					open={publishModal}
					handleClose={() => setPublishModal(false)}
				/>
			)}
		</div>
	)
}

export default SubHeader
