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
