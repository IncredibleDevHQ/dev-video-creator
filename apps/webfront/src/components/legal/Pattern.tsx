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

const Pattern = () => (
	<>
		<svg
			className='hidden sm:block'
			width='252'
			height='181'
			viewBox='0 0 252 181'
			fill='none'
			xmlns='http://www.w3.org/2000/svg'
		>
			<rect
				x='5'
				y='-5'
				width='110'
				height='110'
				rx='55'
				transform='matrix(1 0 0 -1 13.219 110.5)'
				stroke='#16A34A'
				strokeWidth='10'
			/>
			<g filter='url(#a)'>
				<rect
					width='180'
					height='180'
					rx='90'
					transform='matrix(1 0 0 -1 83.219 180.5)'
					fill='#2E2F34'
					fillOpacity='.4'
				/>
			</g>
			<defs>
				<filter
					id='a'
					x='43.219'
					y='-39.5'
					width='260'
					height='260'
					filterUnits='userSpaceOnUse'
					colorInterpolationFilters='sRGB'
				>
					<feFlood floodOpacity='0' result='BackgroundImageFix' />
					<feGaussianBlur in='BackgroundImage' stdDeviation='20' />
					<feComposite
						in2='SourceAlpha'
						operator='in'
						result='effect1_backgroundBlur_3086:31433'
					/>
					<feBlend
						in='SourceGraphic'
						in2='effect1_backgroundBlur_3086:31433'
						result='shape'
					/>
				</filter>
			</defs>
		</svg>

		<svg
			className='block sm:hidden'
			width='276'
			height='181'
			viewBox='0 0 276 181'
			fill='none'
			xmlns='http://www.w3.org/2000/svg'
		>
			<rect
				x='5'
				y='-5'
				width='110'
				height='110'
				rx='55'
				transform='matrix(1 0 0 -1 13.219 110.5)'
				stroke='#16A34A'
				strokeWidth='10'
			/>
			<g filter='url(#a)'>
				<rect
					width='180'
					height='180'
					rx='90'
					transform='matrix(1 0 0 -1 83.219 180.5)'
					fill='#2E2F34'
					fillOpacity='.4'
				/>
			</g>
			<defs>
				<filter
					id='a'
					x='43.219'
					y='-39.5'
					width='260'
					height='260'
					filterUnits='userSpaceOnUse'
					colorInterpolationFilters='sRGB'
				>
					<feFlood floodOpacity='0' result='BackgroundImageFix' />
					<feGaussianBlur in='BackgroundImage' stdDeviation='20' />
					<feComposite
						in2='SourceAlpha'
						operator='in'
						result='effect1_backgroundBlur_3086:31467'
					/>
					<feBlend
						in='SourceGraphic'
						in2='effect1_backgroundBlur_3086:31467'
						result='shape'
					/>
				</filter>
			</defs>
		</svg>
	</>
)

export default Pattern
