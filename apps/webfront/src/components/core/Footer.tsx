// Copyright 2022 Pixelbyte Studio Pvt Ltd
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import Discord from 'svg/Discord.svg'
import Instagram from 'svg/Instagram.svg'
import Linkedin from 'svg/Linkedin.svg'
import Logotype from 'svg/Logotype.svg'
import Twitter from 'svg/Twitter.svg'
import Youtube from 'svg/Youtube.svg'

const Footer = () => (
	<footer className='bg-dark-400'>
		<div className='container flex flex-col mx-auto py-14'>
			<div className='flex flex-col space-y-6'>
				<div>
					<Logotype />
				</div>
				<div className='flex flex-row flex-wrap space-x-6'>
					<div>
						<a
							href='https://twitter.com/incredibledevhq'
							target='_blank'
							rel='noreferrer'
						>
							<Twitter />
						</a>
					</div>
					<div>
						<a
							href='https://www.youtube.com/c/Incredibledev'
							target='_blank'
							rel='noreferrer'
						>
							<Youtube />
						</a>
					</div>
					<div>
						<a
							href='https://www.linkedin.com/company/incredible-dev'
							target='_blank'
							rel='noreferrer'
						>
							<Linkedin />
						</a>
					</div>
					<div>
						<a
							href='https://www.instagram.com/incredibledevhq'
							target='_blank'
							rel='noreferrer'
						>
							<Instagram />
						</a>
					</div>
					<div>
						<a
							href='https://discord.gg/jJQWQs8Fh2'
							target='_blank'
							rel='noreferrer'
						>
							<Discord />
						</a>
					</div>
				</div>
			</div>
			<div className='flex flex-wrap justify-start mt-24 space-y-4 sm:flex-row sm:justify-between sm:space-y-0'>
				<div className='flex flex-row space-x-6'>
					<p className='text-size-sm font-normal text-white'>
						© Pixelbyte Studio Pvt Ltd 2021. All rights reserved.
					</p>
				</div>
			</div>
		</div>
	</footer>
)

export default Footer
