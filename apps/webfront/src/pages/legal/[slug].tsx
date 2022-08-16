import { format, parseISO } from 'date-fns'
import Container from 'src/components/core/Container'
import Footer from 'src/components/core/Footer'
import Header from 'src/components/core/Header'
import Content from 'src/components/legal/Content'
import Hero from 'src/components/legal/HeroText'
import markdownToHtml, { getPostBySlug } from 'src/utils/helpers/mdToHtml'

type Params = {
	params: {
		slug: string
	}
}
type Props = {
	title: string
	date: string
	content: string
}

export async function getStaticProps({ params }: Params) {
	const post = await getPostBySlug(params.slug, [
		'title',
		'date',
		'slug',
		'content',
	])
	const content = await markdownToHtml(post.content || '')
	return {
		props: {
			...post,
			content,
		},
	}
}

export async function getStaticPaths() {
	const slugs = ['privacy-policy']

	return {
		paths: slugs.map(slug => ({
			params: {
				slug,
			},
		})),
		fallback: false,
	}
}

const PostLayout = ({ title, date, content }: Props) => (
	<Container>
		<Header />
		<div className='container mx-auto'>
			<Hero
				title={title}
				description={`Effective: ${format(
					parseISO(JSON.parse(date)),
					'LLL d, yyyy'
				)}`}
			/>
			<Content content={content} />
		</div>
		<Footer />
	</Container>
)

export default PostLayout
