import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import { useUser } from 'src/utils/providers/auth'

const LoginPage = () => {
	const { replace, query } = useRouter()
	const { user, loadingUser } = useUser()

	useEffect(() => {
		if (user) {
			if (query.continue && typeof query.continue === 'string') {
				replace(query.continue)
				return
			}
			replace('/dashboard')
		}
	}, [user, replace, query])

	if (loadingUser || user) return <div>Loading</div>

	return (
		<div className='flex flex-col'>
			<button
				className='border'
				type='button'
				onClick={async () => {
					const provider = new GoogleAuthProvider()
					await signInWithPopup(getAuth(), provider)
				}}
			>
				Login
			</button>
		</div>
	)
}

export default LoginPage
