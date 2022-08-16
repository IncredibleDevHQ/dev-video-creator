import Pattern from './Pattern'

const Hero = ({
	title,
	description,
}: {
	title: string
	description: string
}) => (
	<div className='flex flex-col items-center my-24 space-y-20 md:my-40 sm:flex-row sm:space-y-0 '>
		<div className='container mx-auto'>
			<h1 className='text-dark-title 2xl:text-[128px] 2xl:leading-[128px] xl:text-[90px] xl:leading-[90px] lg:text-[64px] lg:leading-[64px] text-[48px] leading-[48px] font-extrabold font-main'>
				{title}
			</h1>
			<p className='mt-4 sm:w-1/2 text-dark-title-200 font-body'>
				{description}
			</p>
		</div>
		<div className='relative sm:absolute sm:right-0'>
			<Pattern />
		</div>
	</div>
)

export default Hero
