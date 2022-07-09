import { cx } from '@emotion/css'
import { Heading } from 'ui/src'
import { VideoBlockView, CaptionTitleView } from 'utils/src'

const VideoBlockMode = ({
	view,
	updateView,
}: {
	view: VideoBlockView
	updateView: (view: VideoBlockView) => void
}) => (
	<div className='flex flex-col p-5'>
		<Heading textStyle='extraSmallTitle' className='font-bold'>
			Video Style
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
								video: {
									...view.video,
									captionTitleView: style,
								},
							})
						}
						className={cx(
							'border border-gray-200 h-full w-full rounded-sm p-px',
							{
								'border-gray-800': view.video.captionTitleView === style,
							}
						)}
					>
						{style === 'none' && (
							<div
								className={cx('bg-gray-100 w-full h-full p-2', {
									'bg-gray-200': view.video.captionTitleView === style,
								})}
							>
								<div
									className={cx('w-full h-full bg-gray-300 rounded-sm', {
										'!bg-gray-800': view.video.captionTitleView === style,
										'bg-gray-200': view.video.captionTitleView === style,
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
										'bg-gray-200': view.video.captionTitleView === style,
									}
								)}
							>
								<div
									style={{
										borderRadius: '2px',
									}}
									className={cx('w-full h-full bg-gray-300', {
										'!bg-gray-800': view.video.captionTitleView === style,
									})}
								/>
								<div className='aspect-w-1 aspect-h-1 w-full'>
									<div
										style={{
											borderRadius: '3px',
										}}
										className={cx('w-full h-full bg-gray-300', {
											'!bg-gray-800': view.video.captionTitleView === style,
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
										'bg-gray-200': view.video.captionTitleView === style,
									}
								)}
							>
								<div
									style={{
										borderRadius: '2px',
									}}
									className={cx('w-full h-3 bg-gray-300', {
										'!bg-gray-800': view.video.captionTitleView === style,
									})}
								/>
								<div
									style={{
										borderRadius: '2px',
									}}
									className={cx('w-full h-full bg-gray-300', {
										'!bg-gray-800': view.video.captionTitleView === style,
									})}
								/>
								<div
									style={{
										borderRadius: '2px',
									}}
									className={cx('w-full h-3 bg-gray-300', {
										'!bg-gray-800': view.video.captionTitleView === style,
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

export default VideoBlockMode
