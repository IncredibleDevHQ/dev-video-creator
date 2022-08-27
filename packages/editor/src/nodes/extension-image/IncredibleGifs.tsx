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
