import { cx } from '@emotion/css'
import { sentenceCase } from 'change-case'
import React from 'react'
import { Button, Text } from 'ui/src'

export enum CollectionFilter {
	all = 'all',
	owner = 'owner',
	collaborator = 'collaborator',
}

export enum StoryFilter {
	recorded = 'recorded',
	draft = 'draft',
}

const Filter = ({
	collectionFilter,
	setCollectionFilter,
}: {
	collectionFilter: CollectionFilter
	setCollectionFilter: React.Dispatch<React.SetStateAction<CollectionFilter>>
}) => (
	<div className='flex justify-between items-center ml-1.5'>
		<div className='flex justify-start items-center'>
			{Object.keys(CollectionFilter).map(key => (
				<Text
					key={key}
					textStyle='caption'
					className={cx('mr-2 text-white cursor-pointer', {
						'!text-dark-title-200': collectionFilter !== key,
					})}
					onClick={() => setCollectionFilter(key as CollectionFilter)}
				>
					{/* @ts-ignore */}
					{sentenceCase(CollectionFilter[key])}
				</Text>
			))}
		</div>
		<div className='justify-end items-center hidden'>
			{Object.keys(StoryFilter).map(key => (
				<Button type='button' className='ml-2' key={key}>
					{/* @ts-ignore */}
					{sentenceCase(StoryFilter[key])}
				</Button>
			))}
		</div>
	</div>
)

export default Filter
