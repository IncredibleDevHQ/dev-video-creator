import { cx } from '@emotion/css'
import { useIncredibleEditor } from 'editor/src'
import { useEffect, useMemo, useState } from 'react'
import { BsCloudCheck } from 'react-icons/bs'
import {
	IoImageOutline,
	IoPlayOutline,
	IoWarningOutline,
} from 'react-icons/io5'
import { useRecoilState, useSetRecoilState } from 'recoil'
import { openStudioAtom, View, viewAtom } from 'src/stores/flick.store'
import { useRoom } from 'src/utils/liveblocks.config'
import TransitionIcon from 'svg/TransitionIcon.svg'
import { Button, Text } from 'ui/src'
import Brand from './Brand'
import Theme from './Theme'

const AutoSave = () => {
	const { editorSaved, providerWebsocketState } = useIncredibleEditor()
	const [connectionState, setConnectionState] = useState<string>()

	const room = useRoom()

	useEffect(() => {
		setConnectionState(room.getConnectionState())
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [room.getConnectionState()])

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

const SubHeader = (): JSX.Element => {
	const setOpenStudio = useSetRecoilState(openStudioAtom)
	return (
		<div className='flex h-12 flex-row justify-between bg-gray-800 px-5'>
			<ViewSwitch />
			<div className='flex h-full items-center'>
				<div className='mr-4'>
					<AutoSave />
				</div>
				<div className='flex h-full items-center gap-x-5 border-l border-gray-700 px-4'>
					<Theme />
					<Brand />
					<Button
						leftIcon={<TransitionIcon />}
						appearance='none'
						className='text-dark-title'
					>
						Transition
					</Button>
				</div>

				<div className='flex h-full items-center gap-x-5 border-l border-gray-700 px-4'>
					<Button
						leftIcon={<IoPlayOutline className='h-4 w-4' />}
						appearance='none'
						className='text-dark-title'
					>
						Recording
					</Button>
					<Button
						leftIcon={<IoImageOutline className='h-4 w-4' />}
						appearance='none'
						className='text-dark-title'
					>
						Thumbnail
					</Button>
				</div>

				<div className='flex h-full items-center gap-x-2 border-l border-gray-700 pl-3'>
					<Button colorScheme='dark' className='text-dark-title'>
						Publish
					</Button>
					<Button
						className='text-dark-title'
						onClick={() => setOpenStudio(true)}
					>
						Record
					</Button>
				</div>
			</div>
		</div>
	)
}

export default SubHeader
