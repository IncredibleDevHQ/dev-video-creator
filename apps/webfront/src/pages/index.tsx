import { useRouter } from 'next/router'
import { useEffect } from 'react'
import Container from 'src/components/core/Container'
import CookieBanner from 'src/components/core/CookieBanner'
import CoreLayout from 'src/components/core/CoreLayout'
import Hero from 'src/components/core/Hero'
import { useUser } from 'src/utils/providers/auth'

const Web = () => {
	const { user, loadingUser } = useUser()
	const { replace } = useRouter()

	useEffect(() => {
		if (!loadingUser && user) {
			if (user.onboarded) {
				replace('/dashboard')
			} else {
				replace('/onboarding')
			}
		}
	}, [user, loadingUser, replace])

	return (
		<Container>
			<CoreLayout>
				<div className='lines'>
					<div className='line' />
					<div className='line' />
					<div className='line' />
					<div className='line' />
					<div className='line' />
				</div>
				<Hero />
			</CoreLayout>
			<CookieBanner />
		</Container>
	)
}

export default Web
