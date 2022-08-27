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
import { format } from 'date-fns'
import Link from 'next/link'
import React from 'react'
import { inferQueryOutput } from 'src/server/trpc'

const clamp = css`
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
	overflow: hidden;
`

const SeriesTile = ({
	series,
}: {
	series: inferQueryOutput<'series.dashboard'>['series'][number]
}) => (
	<Link href={`/series/${series.name}--${series.id}`}>
		<div className='aspect-w-10 aspect-h-6 cursor-pointer'>
			<div className='flex flex-col border border-dark-200 rounded-lg p-6 h-full w-full hover:border-green-600 text-left'>
				<span
					className={cx(
						'text-gray-100 font-main font-semibold text-base w-full',
						clamp
					)}
				>
					{series.name}
				</span>
				<time className='font-body text-dark-title-200 text-size-xs mt-auto'>
					Created on {format(new Date(series.createdAt), 'do MMMM yyyy')}
				</time>
			</div>
		</div>
	</Link>
)

export default SeriesTile
