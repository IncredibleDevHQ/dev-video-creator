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
