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
