import Link from 'next/link'
import { useState } from 'react'
import { IoChevronBackOutline, IoPeopleOutline } from 'react-icons/io5'
import { useRecoilValue } from 'recoil'
import { flickNameAtom } from 'src/stores/flick.store'
import StudioLogo from 'svg/StudioLogo.svg'
import { Button, Heading } from 'ui/src'
import Invite from './Invite'

const Navbar = () => {
	const flickName = useRecoilValue(flickNameAtom)

	const [inviteOpen, setInviteOpen] = useState(true)

	return (
		<div className='relative flex h-12 w-full flex-row items-center justify-between bg-gray-900 px-5'>
			<Link href='/dashboard' passHref>
				<div className='flex items-center gap-x-1 cursor-pointer'>
					<IoChevronBackOutline className='text-gray-400 h-4 w-4' />
					<StudioLogo />
				</div>
			</Link>
			<Heading
				as='h1'
				textStyle='smallTitle'
				className='text-dark-title absolute left-0 right-0 mx-auto w-96 text-center truncate'
			>
				{flickName}
			</Heading>
			<Button
				leftIcon={<IoPeopleOutline className='h-4 w-4' />}
				colorScheme='dark'
				onClick={() => setInviteOpen(true)}
			>
				Invite
			</Button>
			<Invite
				open={inviteOpen}
				handleClose={() => {
					setInviteOpen(false)
				}}
			/>
		</div>
	)
}

export default Navbar
