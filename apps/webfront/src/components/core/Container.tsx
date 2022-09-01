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

/* eslint-disable react/prop-types */
import Head from 'next/head'
import { useRouter } from 'next/router'

const Container = (props: any) => {
	const { children, ...customMeta } = props
	const router = useRouter()
	const meta = {
		title: 'Incredible | Developer videos made easy.',
		description: `A collaborative developer video content creation platform that enables you to become the best dev video creator.`,
		image: 'https://incredible.dev/assets/social/og.jpg',
		twitterImage: 'https://incredible.dev/assets/social/twitter.jpg',
		type: 'website',
		...customMeta,
	}

	return (
		<>
			<Head>
				<title>{meta.title}</title>
				{/* Search Engine */}
				<meta name='robots' content='follow, index' />
				<meta name='description' content={meta.description} />
				<meta name='image' content={meta.image} />
				<link rel='canonical' href={`https://incredible.dev${router.asPath}`} />
				{/* Schema.org for Google */}
				<meta itemProp='name' content={meta.title} />
				<meta itemProp='description' content={meta.description} />
				<meta itemProp='image' content={meta.image} />
				{/* Twitter */}
				<meta name='twitter:card' content='summary_large_image' />
				<meta name='twitter:site' content='@IncredibleDevHQ' />
				<meta name='twitter:creator' content='@IncredibleDevHQ' />
				<meta name='twitter:title' content={meta.title} />
				<meta name='twitter:description' content={meta.description} />
				<meta name='twitter:image:src' content={meta.twitterImage} />
				{/* Open Graph general (Facebook, Pinterest & Google+) */}
				<meta
					name='og:url'
					content={`https://incredible.dev${router.asPath}`}
				/>
				<meta name='og:type' content={meta.type} />
				<meta name='og:site_name' content='Incredible' />
				<meta name='og:title' content={meta.title} />
				<meta name='og:description' content={meta.description} />
				<meta name='og:image' content={meta.image} />
				{/* Published date, if any */}
				{meta.date && (
					<meta property='article:published_time' content={meta.date} />
				)}
			</Head>
			<main className='bg-dark-500 font-main'>{children}</main>
		</>
	)
}

export default Container
