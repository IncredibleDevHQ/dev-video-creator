import { useRouter } from 'next/router'
import { useEffect } from 'react'
import { useUser } from 'src/utils/providers/auth'

const ErrorPage = () => {
	const { push } = useRouter()
	const user = useUser()

	useEffect(() => {
		if (user) {
			push('/dashboard')
		}
	}, [user, push])

	return <div>OOPS! Something went wrong</div>
}

export default ErrorPage
