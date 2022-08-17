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

/* eslint-disable react/no-danger */
import Head from 'next/head'

export interface SEOProps {
	title: string
	description: string
	type: 'website' | 'article' | 'book' | 'profile' | 'video' | 'music'
	keywords: string[]
	image?: string
	url?: string
	twitter_card: 'summary' | 'summary_large_image' | 'app' | 'player'
	generateVideoLDJSON?: boolean
	publishedAt?: string
	contentUrl?: string
	orientation?: 'portrait' | 'landscape'
}

const videoLd = (
	name: string,
	description: string,
	thumbnail: string,
	publishedAt: string,
	contentUrl: string
) => ({
	'@context': 'https://schema.org',
	'@type': 'VideoObject',
	name,
	description,
	thumbnailUrl: [thumbnail],
	uploadDate: publishedAt,
	contentUrl,
})

const SEO = (props: SEOProps) => (
	<Head>
		<title>{props.title}</title>
		<meta name='description' content={props.description} />
		<meta property='og:type' content={props.type} />
		<meta name='application-name' content='Incredible Player' />
		<meta name='og:title' property='og:title' content={props.title} />
		<meta httpEquiv='X-UA-Compatible' content='IE=edge,chrome=1' />
		<meta name='title' content={props.title} />
		<meta charSet='UTF-8' />
		<meta
			name='og:description'
			property='og:description'
			content={props.description}
		/>
		<meta name='viewport' content='width=device-width, initial-scale=1' />
		<meta name='keywords' content={props.keywords.join(',')} />
		<meta property='og:site_name' content='Incredible.dev' />
		<meta property='og:url' content={props.url} />
		<meta
			property='og:image:width'
			content={`${props.orientation === 'portrait' ? 600 : 1200}`}
		/>
		<meta
			property='og:image:height'
			content={`${props.orientation === 'portrait' ? 1200 : 600}`}
		/>
		<meta name='twitter:card' content={props.twitter_card} />
		<meta name='twitter:title' content={props.title} />
		<meta name='twitter:description' content={props.description} />
		{/* <meta name="twitter:site" content={`@${twitter.handle}`} />
        <meta name="twitter:creator" content={`@${twitter.handle}`} /> */}
		<meta name='application-name' content='Incredible Player' />
		<meta name='mobile-web-app-capable' content='yes' />
		<meta name='apple-mobile-web-app-capable' content='yes' />
		<meta
			name='apple-mobile-web-app-status-bar-style'
			content='black-translucent'
		/>
		<meta name='apple-mobile-web-app-title' content='Incredible Player' />

		<link rel='icon' type='image/png' href='/favicon.ico' />
		<link rel='apple-touch-icon' href='/favicon.ico' />

		<meta property='og:image' content={props.image} />
		<meta name='twitter:image' content={props.image} />

		{props.generateVideoLDJSON && (
			<script
				dangerouslySetInnerHTML={{
					__html: JSON.stringify(
						videoLd(
							props.title,
							props.description || props.title,
							props.image || '',
							props.publishedAt || '',
							props.contentUrl || ''
						)
					),
				}}
				type='application/ld+json'
			/>
		)}
	</Head>
)
export default SEO
