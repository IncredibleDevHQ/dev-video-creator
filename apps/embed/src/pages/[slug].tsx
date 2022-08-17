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
import { GetServerSideProps } from 'next'
import dynamic from 'next/dynamic'
import prisma from 'prisma-orm/prisma'
import SEO from 'src/components/seo'
import { inferQueryOutput } from 'src/utils/trpc'
import { IncredibleVideoPlayerProps } from 'ui/src'
import useWindowDimensions from '../utils/useWindowDimensions'

const IncredibleVideoPlayer = dynamic<IncredibleVideoPlayerProps>(
	() => import('ui/src').then(module => module.IncredibleVideoPlayer),
	{
		ssr: false,
	}
)

const noScrollBar = css`
	::-webkit-scrollbar {
		display: none;
	}
`

type Props = {
	content?: inferQueryOutput<'story.getContent'>
	message?: string
	notFound: boolean
	orientation?: 'portrait' | 'landscape'
}

export const getServerSideProps: GetServerSideProps<Props> = async context => {
	const { slug } = context.query as {
		slug: string
	}

	if (!slug)
		return {
			props: {
				notFound: true,
				message: 'Failed to load data.',
			},
		}

	try {
		const data = await prisma.content.findUniqueOrThrow({
			where: {
				id: slug,
			},
			select: {
				id: true,
				isPublic: true,
				preview: true,
				resource: true,
				thumbnail: true,
				type: true,
				data: true,
				flickId: true,
				seriesId: true,
				Mux_Assets: {
					select: {
						muxPlaybackId: true,
					},
				},
			},
		})

		return {
			props: {
				content: data,
				orientation:
					data?.type === 'VerticalVideo' ? 'portrait' : 'landscape' || null,
				notFound: false,
			},
		}
	} catch (error: any) {
		return {
			props: {
				notFound: true,
				message: error?.message || 'Failed to fetch Video',
			},
		}
	}
}

const Embed = (props: Props) => {
	const { height, width } = useWindowDimensions()

	if (!props.content) return null

	const url = `${`${process.env.NEXT_PUBLIC_EMBED_URL}/${props?.content?.id}`}`

	if (props.notFound) {
		return (
			<div className='flex flex-col items-center justify-center w-full h-screen bg-dark-300'>
				<h1 className='text-xl text-gray-300'>Err! Something went wrong</h1>
				<h3 className='text-gray-300'>Video not found</h3>
				<p>{props.message}</p>
			</div>
		)
	}

	if (!props.content?.isPublic) {
		return (
			<div className='flex flex-col items-center justify-center w-full h-screen bg-dark-300'>
				<h1 className='text-xl text-gray-300'>Err! Something went wrong</h1>
				<h3 className='text-gray-300'>This video is not made public yet</h3>
				<p>{props.message}</p>
			</div>
		)
	}

	const content = {
		...props.content,
		data: props.content?.data
			? JSON.parse(JSON.stringify(props.content?.data))
			: null,
	}

	return (
		<div className={cx('w-full h-screen overflow-scroll', noScrollBar)}>
			<SEO
				description={
					content?.data?.description ||
					'Watch latest incredible videos on Incredible.dev'
				}
				title={content?.data?.title || 'Story'}
				keywords={[content?.data?.title]}
				type='video'
				twitter_card='summary_large_image'
				url={url}
				orientation={props?.orientation}
				image={`${process.env.NEXT_PUBLIC_CDN_URL}/${content?.thumbnail}`}
			/>
			<div className='flex flex-col items-center justify-center'>
				{(() => {
					const resourceURL = content?.resource
					const previewURL = content?.thumbnail

					if (!resourceURL) {
						return (
							<div className='flex flex-col items-center justify-center w-full h-screen bg-dark-300'>
								<h1 className='text-xl text-gray-300'>
									Err! Something went wrong
								</h1>
								<h3 className='text-gray-300'>Could not load the video</h3>
							</div>
						)
					}

					return (
						<IncredibleVideoPlayer
							windowWidth={width}
							windowHeight={height}
							orientation={props.orientation}
							ctas={content?.data?.ctas}
							blocks={content?.data?.blocks}
							heading={content?.data?.title}
							src={`${process.env.NEXT_PUBLIC_CDN_URL}${resourceURL}`}
							poster={`${process.env.NEXT_PUBLIC_CDN_URL}${previewURL}`}
						/>
					)
				})()}
			</div>
		</div>
	)
}

export default Embed
