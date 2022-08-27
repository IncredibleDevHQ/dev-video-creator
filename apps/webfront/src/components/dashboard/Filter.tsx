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
