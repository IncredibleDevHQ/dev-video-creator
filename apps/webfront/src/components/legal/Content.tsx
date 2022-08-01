const Content = ({ content }: { content: string }) => (
	<div className='max-w-5xl pb-40 mx-auto'>
		<div
			className='mx-auto prose prose-invert lg:prose-xl prose-p:font-body'
			// eslint-disable-next-line react/no-danger
			dangerouslySetInnerHTML={{ __html: content }}
		/>
	</div>
)

export default Content
