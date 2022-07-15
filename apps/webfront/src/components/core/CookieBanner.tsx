import { cx } from '@emotion/css'
import { useState } from 'react'
import Check from 'svg/Check.svg'
import { IconButton } from 'ui/src'

const CookieBanner = () => {
	const [show, setShow] = useState(true)

	return (
		<div
			className={cx('container md:px-0 px-6', {
				hidden: !show,
			})}
		>
			<div className='z-50 flex flex-row items-center fixed left-0 right-0 bottom-10 mx-auto space-x-6 w-full md:max-w-[485px] max-w-[330px] rounded-lg px-6 py-4 backdrop-filter backdrop-blur-2xl bg-dark-300 bg-opacity-20'>
				<p className='text-size-sm font-normal text-dark-title-200'>
					By visiting our website, you agree to our 🍪 cookie policy
				</p>
				<IconButton
					colorScheme='dark'
					icon={<Check />}
					onClick={() => {
						setShow(false)
					}}
				/>
			</div>
		</div>
	)
}

export default CookieBanner
