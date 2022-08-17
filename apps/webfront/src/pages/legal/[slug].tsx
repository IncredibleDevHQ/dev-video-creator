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
