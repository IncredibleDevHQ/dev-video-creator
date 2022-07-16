import { useRouter } from 'next/router'
import { useEffect } from 'react'
import OnBoarding from 'src/components/onboarding/OnBoarding'
import { useUser } from 'src/utils/providers/auth'
import { ScreenState } from 'ui/src'

const OnboardingPage = () => {
	const { user, loadingUser } = useUser()
	const router = useRouter()

	useEffect(() => {
		if (user && user.onboarded) {
			router.push('/dashboard')
		}
	}, [user])

	if (!user || loadingUser) {
		return <ScreenState title='Loading' />
	}

	return user && user.onboarded ? (
		<ScreenState title='Redirecting you to dashboard' />
	) : (
		<OnBoarding />
	)
}

export default OnboardingPage
