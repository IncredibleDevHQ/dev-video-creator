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

import { css, cx } from '@emotion/css'
import StackGrid from 'react-stack-grid'
import { useEnv } from 'utils/src'

const noScrollbar = css`
	::-webkit-scrollbar {
		display: none;
	}
`

const incredibleGifs = [
	'API.gif',
	'Active-user.gif',
	'Backend.gif',
	'Coding-day-and-night.gif',
	'Coding-day-night.gif',
	'Confused.gif',
	'Data-analytics.gif',
	'Data-stream.gif',
	'Fast-performance.gif',
	'Front-End.gif',
	'Graph-curve.gif',
	'Github.gif',
	'Launch.gif',
	'Link.gif',
	'Link_2.gif',
	'Link_3.gif',
	'Logging.gif',
	'Logging_2.gif',
	'New-User.gif',
	'Processing.gif',
	'Processing_2.gif',
	'Pulse.gif',
	'Resurrected-user.gif',
	'Route.gif',
	'Route---Portrait.gif',
	'Runtime-1.gif',
	'Settings.gif',
	'Settings_2.gif',
	'Success.gif',
	'Video-Call.gif',
]

export const IncredibleGifs = ({
	updateAttributes,
	setLocalSrc,
}: {
	updateAttributes: any
	setLocalSrc: React.Dispatch<React.SetStateAction<string | undefined>>
}) => {
	const { storage } = useEnv()

	return (
		<div
			className='flex flex-col'
			style={{
				height: '300px',
			}}
		>
			<StackGrid
				className={cx(' overflow-scroll -ml-px', noScrollbar)}
				columnWidth={153}
				gutterHeight={10}
				gutterWidth={10}
				monitorImagesLoaded
				appearDelay={100}
				duration={0}
			>
				{incredibleGifs.map(gif => (
					<button
						type='button'
						onClick={() => {
							setLocalSrc(`${storage.cdn}gifs/${gif}`)
							updateAttributes({
								src: `${storage.cdn}gifs/${gif}`,
							})
						}}
					>
						<img
							src={`${storage.cdn}gifs/${gif}`}
							alt={gif}
							className='object-cover h-full cursor-pointer border'
						/>
					</button>
				))}
			</StackGrid>
		</div>
	)
}
