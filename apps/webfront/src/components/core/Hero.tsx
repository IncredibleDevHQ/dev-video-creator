// Copyright (c) 2022 Pixelbyte Studio Pvt Ltd
//
// This file is part of Incredible, Pixelbyte Studio Pvt Ltd
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program\.  If not, see <http://www\.gnu\.org/licenses/>\.

import { useRouter } from 'next/router'
import { FaDiscord } from 'react-icons/fa'

import { Button } from 'ui/src'
import Pattern from './Pattern'

const Hero = () => {
	const router = useRouter()

	return (
		<div className='relative min-h-screen'>
			<div className='relative flex flex-col md:flex-row items-center min-h-screen'>
				<div className='container static z-10 mx-auto'>
					<div className='grid grid-cols-6 p-6 gap-x-4 lg:gap-y-16 xs:gap-y-4 sm:py-24 sm:px-20 '>
						<div className='flex flex-col order-1 mb-4 space-y-6 lg:col-start-1 lg:col-span-4 xs:col-span-full lg:order-2 lg:mb-0'>
							<h1 className='blink text-dark-title 2xl:text-[128px] 2xl:leading-[128px] xl:text-[90px] xl:leading-[90px] lg:text-[64px] lg:leading-[64px] text-[72px] leading-[72px] font-extrabold font-main'>
								Plan,
								<br /> Create, Share
							</h1>

							<div className='flex flex-col sm:flex-row gap-4'>
								<Button
									className='sm:w-max xs:max-w-none'
									size='large'
									onClick={() => {
										router.push('/login')
									}}
								>
									Sign in
								</Button>
								<a
									href='https://discord.gg/jJQWQs8Fh2'
									target='_blank'
									rel='noopener noreferrer'
								>
									<Button
										className='sm:w-max xs:max-w-none w-full'
										size='large'
										colorScheme='dark'
										leftIcon={<FaDiscord size={16} />}
									>
										Join Discord
									</Button>
								</a>
							</div>
						</div>
						<div className='lg:w-[320px] xs:w-full lg:col-start-3 col-span-full col-start-1 lg:order-1 order-2'>
							<p className='font-normal text-dark-title-200'>
								Collaborate & create amazing developer videos and blogs in
								record time
							</p>
						</div>
						<div className='lg:w-[320px] w-full lg:col-start-5 lg:col-span-3 col-span-full col-start-1 order-3'>
							<p className='font-normal text-dark-title-200'>
								Pick from dozens of incredible templates, designed for near-zero
								editing experience
							</p>
						</div>
						<div className='lg:w-[210px] w-full lg:col-start-2 col-span-full col-start-1 order-4'>
							<p className='col-span-2 font-normal text-dark-title-200'>
								Share it, download it or embed it
							</p>
						</div>
					</div>
				</div>
				<div className='relative md:absolute mt-auto bottom-0 right-0'>
					<Pattern />
				</div>
			</div>
		</div>
	)
}

export default Hero
