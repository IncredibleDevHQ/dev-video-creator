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
import { useEffect, useRef, useState } from 'react'
import { IoReloadOutline, IoSearchOutline } from 'react-icons/io5'
import StackGrid from 'react-stack-grid'
import { useDebouncedCallback } from 'use-debounce'
import { Text } from 'ui/src'
import axios from 'axios'

const noScrollbar = css`
	::-webkit-scrollbar {
		display: none;
	}
`

export const UnsplashTab = ({
	updateAttributes,
	setLocalSrc,
}: {
	updateAttributes: any
	setLocalSrc: React.Dispatch<React.SetStateAction<string | undefined>>
}) => {
	const [search, setSearch] = useState('enjoy')

	const [data, setData] = useState<any[]>()
	const [error, setError] = useState<string | undefined>()

	const gridRef = useRef<StackGrid>(null)

	const getImages = async () => {
		try {
			const response = await axios.post(
				`${process.env.NEXT_PUBLIC_BASE_URL}/api/trpc/util.searchUnsplash`,
				{
					json: {
						query: search,
					},
				},
				{
					headers: {
						'Content-Type': 'application/json',
					},
				}
			)
			if (response.data?.result?.data?.json) {
				setError(undefined)
				setData(response.data.result.data.json)
			} else {
				setError('No results found')
			}
		} catch (e) {
			setError((e as unknown as any).message)
		}
	}

	const debounced = useDebouncedCallback(() => {
		getImages()
	}, 1000)

	useEffect(() => {
		debounced()
	}, [search])

	const divRef = useRef<HTMLDivElement>(null)

	return error ? (
		<div className='flex flex-col items-center justify-center w-full mt-8'>
			<IoReloadOutline className='text-gray-400' />
			<Text
				textStyle='caption'
				className='text-blue-700 cursor-pointer hover:underline'
				onClick={() => getImages()}
			>
				Retry
			</Text>
		</div>
	) : (
		<div
			ref={divRef}
			className='flex flex-col'
			style={{
				height: '300px',
			}}
		>
			<div className='flex items-center w-full rounded-sm gap-x-2 bg-gray-100'>
				<IoSearchOutline size={18} className='ml-3 text-gray-400' />
				<input
					className='w-full py-1.5 pr-3 placeholder-gray-400 focus:outline-none font-body text-sm bg-gray-100 rounded-sm'
					onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
						setSearch(e.target.value)
					}
					placeholder='Search'
				/>
			</div>

			<StackGrid
				ref={gridRef}
				className={cx('mt-4 overflow-scroll -ml-px', noScrollbar)}
				columnWidth={153}
				gutterHeight={10}
				gutterWidth={10}
				monitorImagesLoaded
				duration={0}
			>
				{data &&
					data &&
					data.map((r: any) => (
						<button
							type='button'
							onClick={() => {
								updateAttributes({
									src: r.urls.full,
								})
								setLocalSrc(r.urls.small)
							}}
						>
							<img
								src={r.urls.thumb}
								alt={r.alt_description || ''}
								className='object-cover h-full cursor-pointer'
							/>
						</button>
					))}
			</StackGrid>
		</div>
	)
}
