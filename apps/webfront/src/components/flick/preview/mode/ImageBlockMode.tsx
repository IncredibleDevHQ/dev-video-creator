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
import { Heading } from 'ui/src'
import { ImageBlockView, CaptionTitleView } from 'utils/src'

const ImageBlockMode = ({
	view,
	updateView,
}: {
	view: ImageBlockView
	updateView: (view: ImageBlockView) => void
}) => (
	<div className='flex flex-col p-5'>
		<Heading textStyle='extraSmallTitle' className='font-bold'>
			Image Style
		</Heading>
		<div className='grid grid-cols-3 mt-2 gap-2'>
			{(
				[
					'none',
					'titleOnly',
					'captionOnly',
					'titleAndCaption',
				] as CaptionTitleView[]
			).map(style => (
				<div className='aspect-w-1 aspect-h-1'>
					<button
						type='button'
						onClick={() =>
							updateView({
								...view,
								image: {
									...view.image,
									captionTitleView: style,
								},
							})
						}
						className={cx(
							'border border-gray-200 h-full w-full rounded-sm p-px ',
							{
								'border-gray-800': view.image.captionTitleView === style,
							}
						)}
					>
						{style === 'none' && (
							<div
								className={cx('bg-gray-100 w-full h-full p-2', {
									'bg-gray-200': view.image.captionTitleView === style,
								})}
							>
								<div
									className={cx('w-full h-full bg-gray-300 rounded-sm', {
										'!bg-gray-800': view.image.captionTitleView === style,
									})}
								/>
							</div>
						)}
						{(style === 'titleOnly' || style === 'captionOnly') && (
							<div
								style={{
									paddingLeft: '13px',
									paddingRight: '13px',
								}}
								className={cx(
									'flex flex-col items-center justify-center gap-y-1 bg-gray-100 w-full h-full p-2',
									{
										'flex-col-reverse': style === 'captionOnly',
										'bg-gray-200': view.image.captionTitleView === style,
									}
								)}
							>
								<div
									style={{
										borderRadius: '2px',
									}}
									className={cx('w-full h-full bg-gray-300', {
										'!bg-gray-800': view.image.captionTitleView === style,
									})}
								/>
								<div className='aspect-w-1 aspect-h-1 w-full'>
									<div
										style={{
											borderRadius: '3px',
										}}
										className={cx('w-full h-full bg-gray-300', {
											'!bg-gray-800': view.image.captionTitleView === style,
										})}
									/>
								</div>
							</div>
						)}
						{style === 'titleAndCaption' && (
							<div
								style={{
									paddingLeft: '13px',
									paddingRight: '13px',
								}}
								className={cx(
									'flex flex-col items-center justify-center gap-y-1 bg-gray-100 w-full h-full p-2',
									{
										'bg-gray-200': view.image.captionTitleView === style,
									}
								)}
							>
								<div
									style={{
										borderRadius: '2px',
									}}
									className={cx('w-full h-3 bg-gray-300', {
										'!bg-gray-800': view.image.captionTitleView === style,
									})}
								/>
								<div
									style={{
										borderRadius: '2px',
									}}
									className={cx('w-full h-full bg-gray-300', {
										'!bg-gray-800': view.image.captionTitleView === style,
									})}
								/>
								<div
									style={{
										borderRadius: '2px',
									}}
									className={cx('w-full h-3 bg-gray-300', {
										'!bg-gray-800': view.image.captionTitleView === style,
									})}
								/>
							</div>
						)}
					</button>
				</div>
			))}
		</div>
	</div>
)

export default ImageBlockMode
