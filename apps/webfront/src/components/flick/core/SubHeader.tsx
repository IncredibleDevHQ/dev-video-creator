import { cx } from '@emotion/css'
import BrandIcon from 'svg/BrandIcon.svg'
import TransitionIcon from 'svg/TransitionIcon.svg'
import { Button, Text } from 'ui/src'
import { BsCloudCheck } from 'react-icons/bs'
import { IoAlbumsOutline, IoImageOutline, IoPlayOutline } from 'react-icons/io5'
import { useRecoilState } from 'recoil'
import { View, viewAtom } from 'src/stores/flick.store'

const AutoSave = () => (
	<div className='flex items-center gap-x-2 text-gray-400'>
		<BsCloudCheck />
		<Text textStyle='bodySmall'>Saved</Text>
	</div>
)

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

const SubHeader = (): JSX.Element => (
	<div className='flex h-12 flex-row justify-between bg-gray-800 px-5'>
		<ViewSwitch />
		<div className='flex h-full items-center'>
			<div className='mr-4'>
				<AutoSave />
			</div>
			<div className='flex h-full items-center gap-x-5 border-l border-gray-700 px-4'>
				<Button
					leftIcon={<IoAlbumsOutline className='h-4 w-4' />}
					appearance='none'
					className='text-dark-title'
				>
					Theme
				</Button>
				<Button
					leftIcon={<BrandIcon />}
					appearance='none'
					className='text-dark-title'
				>
					Brand
				</Button>
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
				<Button className='text-dark-title'>Record</Button>
			</div>
		</div>
	</div>
)

export default SubHeader
