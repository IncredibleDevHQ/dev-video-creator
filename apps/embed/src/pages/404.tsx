import NotFound from 'svg/404.svg'

const FourOhFour = () => (
	<div className='flex flex-row items-center justify-center h-screen px-2 md:px-0 relative'>
		<div className='flex flex-col space-y-16'>
			<NotFound />
			<div className='text-center'>
				<p className='mb-2 text-3xl font-bold text-white font-main'>
					Uh-oh, resource not found
				</p>
				<p className='mb-6 text-base font-normal text-dark-title-200 font-body'>
					Sorry, this resource doesn’t exist or it was removed
				</p>
			</div>
		</div>
	</div>
)

export default FourOhFour
