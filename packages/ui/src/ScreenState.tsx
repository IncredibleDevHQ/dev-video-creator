export const ScreenState = ({
	title,
	subtitle,
	button,
	onHandleClick,
	loading = true,
}: {
	title?: string
	subtitle?: string
	button?: string
	onHandleClick?: () => void
	loading?: boolean
}) => (
	<div className='fixed left-0 top-0 z-10 flex min-h-screen w-screen flex-col items-center justify-center bg-dark-500 p-4'>
		{loading && <div className='w-14 h-14 loader' />}

		<div style={{ maxWidth: 256 }}>
			{title && (
				<h2 className='text-xl mt-8 mb-2 text-center font-bold text-gray-100'>
					{title}
				</h2>
			)}
			{subtitle && (
				<h4 className='text-sm text-center text-gray-200'>{subtitle}</h4>
			)}
		</div>
		{button && (
			<button type='button' className='mt-12' onClick={onHandleClick}>
				{button}
			</button>
		)}
	</div>
)

ScreenState.defaultProps = {
	title: undefined,
	subtitle: undefined,
	button: undefined,
	onHandleClick: undefined,
	loading: true,
}
