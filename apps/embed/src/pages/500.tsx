const ErrorPage = () => (
	<div className='flex flex-row items-center justify-center h-screen px-2 md:px-0 relative'>
		<div className='flex flex-col'>
			<div className='text-center'>
				<p className='mb-2 text-[150px] font-bold text-white font-main -mt-12'>
					Oops!
				</p>
				<p className='mb-6 text-base font-normal text-dark-title-200 font-body'>
					Sorry, something went wrong
				</p>
			</div>
		</div>
	</div>
)

export default ErrorPage
