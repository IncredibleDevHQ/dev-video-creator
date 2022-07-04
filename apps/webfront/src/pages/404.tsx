import { useRouter } from 'next/router'
import { useEffect } from 'react'
import { useUser } from 'src/utils/providers/auth'

const FourOhFour = () => {
	const { push } = useRouter()
	const user = useUser()

	useEffect(() => {
		if (user) {
			push('/dashboard')
		}
	}, [user, push])

	return <div>NOT FOUND 404</div>
}

export default FourOhFour
