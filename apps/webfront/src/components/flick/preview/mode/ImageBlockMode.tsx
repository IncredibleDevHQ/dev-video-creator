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
