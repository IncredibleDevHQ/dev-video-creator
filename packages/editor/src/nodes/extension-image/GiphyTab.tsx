import { css, cx } from '@emotion/css'
import { GiphyFetch } from '@giphy/js-fetch-api'
import { Grid } from '@giphy/react-components'
import { useState, useEffect, useRef } from 'react'
import { IoSearchOutline } from 'react-icons/io5'
import { getEnv } from 'utils/src'

const gf = new GiphyFetch(getEnv().giphyApiKey as string)

const noScrollbar = css`
	::-webkit-scrollbar {
		display: none;
	}
`

export const GiphyTab = ({
	updateAttributes,
	setLocalSrc,
}: {
	updateAttributes: any
	setLocalSrc: React.Dispatch<React.SetStateAction<string | undefined>>
}) => {
	const [search, setSearch] = useState<string | undefined>('')

	useEffect(() => {
		setSearch(undefined)
	}, [])

	const fetchGifs = (offset: number) =>
		search ? gf.search(search, { offset }) : gf.trending({ offset })

	const divRef = useRef<HTMLDivElement>(null)

	return (
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
					value={search}
					className='w-full py-1.5 pr-3 placeholder-gray-400 focus:outline-none font-body text-sm bg-gray-100 rounded-sm'
					onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
						setSearch(e.target.value)
					}
					placeholder='Search'
				/>
			</div>
			<Grid
				className={cx('mt-4 overflow-y-scroll', noScrollbar)}
				key={search}
				columns={3}
				onGifClick={(gif, e) => {
					e.preventDefault()
					updateAttributes({
						src: `https://i.giphy.com/media/${gif.id}/giphy.gif`,
					})
					setLocalSrc(`https://i.giphy.com/media/${gif.id}/giphy.gif`)
				}}
				width={divRef.current?.clientWidth || 0}
				fetchGifs={fetchGifs}
				borderRadius={0}
				gutter={10}
			/>
		</div>
	)
}
