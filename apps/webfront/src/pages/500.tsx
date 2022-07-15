import Link from 'next/link'
import { useEffect } from 'react'
import Container from 'src/components/core/Container'
import usePush from 'src/utils/hooks/usePush'
import { useUser } from 'src/utils/providers/auth'

const ErrorPage = () => {
	const push = usePush()
	const user = useUser()

	useEffect(() => {
		if (user) {
			push('/dashboard')
		}
	}, [user, push])

	return (
		<Container title='500 - Incredible'>
			<div className='flex flex-row items-center justify-center h-screen px-2 md:px-0 relative'>
				<div className='flex flex-col'>
					<div className='text-center'>
						<p className='mb-2 text-[150px] font-bold text-white font-main -mt-12'>
							500
						</p>
						<p className='mb-6 text-base font-normal text-dark-title-200 font-body'>
							Sorry, something went wrong
						</p>

						<Link href='/' passHref>
							<div className='px-5 py-3 text-base font-semibold text-white rounded cursor-pointer font-main bg-green-600 transition-all transform active:scale-95'>
								Go home
							</div>
						</Link>
					</div>
				</div>
			</div>
		</Container>
	)
}

export default ErrorPage
