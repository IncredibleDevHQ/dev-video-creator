import { cx } from '@emotion/css'
import { useEffect, useState } from 'react'
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton'
import { useUser } from 'src/utils/providers/auth'
import { Button, Heading, Text } from 'ui/src'
import trpc, { inferQueryOutput } from '../../server/trpc'
import { customScroll } from '../flick/studio/Notes'
import Filter, { CollectionFilter } from './Filter'
import SeriesHeader from './SeriesHeader'
import SeriesTile from './SeriesTile'

const SeriesTab = () => {
	const { user } = useUser()

	const {
		data,
		error,
		isLoading: loading,
		refetch,
		fetchNextPage,
	} = trpc.useInfiniteQuery(
		[
			'series.dashboard',
			{
				limit: 10,
			},
		],
		{
			getNextPageParam: lastPage => lastPage.nextCursor,
		}
	)

	const [allData, setAllData] = useState<inferQueryOutput<'series.dashboard'>>()

	const [collectionFilter, setCollectionFilter] = useState<CollectionFilter>(
		CollectionFilter.all
	)

	useEffect(() => {
		refetch()
	}, [])

	useEffect(() => {
		if (data) {
			const pageNumber = Number((data.pages.length / 25).toFixed(0))
			setAllData(data.pages[pageNumber > 0 ? pageNumber - 1 : 0])
		}
	}, [data])

	return (
		<div
			className={cx(
				'flex flex-col items-center overflow-y-scroll flex-1 pr-5 h-full text-white',
				customScroll
			)}
			onScroll={e => {
				if (
					e.currentTarget.scrollHeight - e.currentTarget.scrollTop >
						e.currentTarget.clientHeight - 2 &&
					e.currentTarget.scrollHeight - e.currentTarget.scrollTop <
						e.currentTarget.clientHeight + 2
				) {
					if (loading) return
					// fetchMore({
					// 	variables: {
					// 		offset: offset + 25,
					// 	},
					// 	updateQuery: (prev, { fetchMoreResult }) => {
					// 		if (!fetchMoreResult) return prev
					// 		return {
					// 			...prev,
					// 			Series: [...prev.Series, ...fetchMoreResult.Series],
					// 		}
					// 	},
					// })
					fetchNextPage()
				}
			}}
		>
			{allData && allData.series.length === 0 && (
				<div className='flex-1 flex flex-col items-center justify-center gap-y-8'>
					<Heading textStyle='mediumTitle'>
						A series is a collection of your stories. Click below to create your
						own
					</Heading>
					<SeriesHeader
						refresh={() => {
							refetch()
						}}
					/>
				</div>
			)}

			{((loading && user) ||
				error ||
				(data && allData && allData.series.length > 0)) && (
				<div className='flex flex-col flex-1 py-8 container'>
					<div className='flex items-center mb-8 justify-between'>
						<Filter
							collectionFilter={collectionFilter}
							setCollectionFilter={setCollectionFilter}
						/>
						<SeriesHeader
							refresh={() => {
								refetch()
							}}
						/>
					</div>
					{loading && !data && (
						<SkeletonTheme color='#202020' highlightColor='#444'>
							<div className='flex-1 grid grid-cols-4 gap-10'>
								{[...Array(10).keys()].map(() => (
									<Skeleton height={160} />
								))}
							</div>
						</SkeletonTheme>
					)}
					{error && (
						<div className='flex flex-col flex-1 justify-center items-center gap-y-3'>
							<Text className='text-lg'>
								Something went wrong. Please try again.
							</Text>
							<Button onClick={() => refetch()}>Retry</Button>
						</div>
					)}

					<div className='grid grid-cols-4 gap-10'>
						{allData?.series
							.filter(series => {
								if (collectionFilter === CollectionFilter.all) return true
								if (collectionFilter === CollectionFilter.owner)
									return series.ownerSub === user?.uid
								if (collectionFilter === CollectionFilter.collaborator)
									return series.ownerSub !== user?.uid
								return true
							})
							.map(series => (
								<SeriesTile series={series} />
							))}
					</div>
				</div>
			)}
		</div>
	)
}

export default SeriesTab
