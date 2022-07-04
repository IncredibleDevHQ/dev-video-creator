import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import { useUser } from 'src/utils/providers/auth'
import { Heading } from 'ui/src'

const Web = () => {
	const { user, loadingUser } = useUser()
	const { replace } = useRouter()

	useEffect(() => {
		if (!loadingUser && user) {
			replace('/dashboard')
		}
	}, [user, loadingUser, replace])

	return (
		<div>
			<Heading>Webfront</Heading>
			<Link href='/login' passHref>
				<span className='underline'>Login</span>
			</Link>
		</div>
	)
}

export default Web
