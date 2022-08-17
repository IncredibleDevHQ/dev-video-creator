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
