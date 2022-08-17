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

import { Html, Head, Main, NextScript } from 'next/document'

const Document = () => (
	<Html lang='en'>
		<Head>
			{/* Preload Gilroy and Inter Fonts */}
			<link
				rel='preload'
				href='/fonts/Gilroy/gilroy-extrabold-latin.woff2'
				as='font'
				type='font/woff2'
				crossOrigin='anonymous'
			/>
			<link
				rel='preload'
				href='/fonts/Gilroy/gilroy-bold-latin.woff2'
				as='font'
				type='font/woff2'
				crossOrigin='anonymous'
			/>
			<link
				rel='preload'
				href='/fonts/Gilroy/gilroy-semibold-latin.woff2'
				as='font'
				type='font/woff2'
				crossOrigin='anonymous'
			/>
			<link
				rel='preload'
				href='/fonts/Inter/inter-var-latin.woff2'
				as='font'
				type='font/woff2'
				crossOrigin='anonymous'
			/>

			{/* Favicons */}
			<link
				rel='apple-touch-icon'
				sizes='180x180'
				href='/favicons/apple-touch-icon.png?v=005'
			/>
			<link
				rel='icon'
				type='image/png'
				sizes='32x32'
				href='/favicons/favicon-32x32.png?v=005'
			/>
			<link
				rel='icon'
				type='image/png'
				sizes='16x16'
				href='/favicons/favicon-16x16.png?v=005'
			/>
			<link rel='manifest' href='/favicons/site.webmanifest?v=005' />
			<link
				rel='mask-icon'
				href='/favicons/safari-pinned-tab.svg?v=005'
				color='#16a34a'
			/>
			<link rel='icon' href='/favicons/favicon.ico?v=005' />
			<meta name='msapplication-TileColor' content='#ffffff' />
			<meta
				name='msapplication-config'
				content='/favicons/browserconfig.xml?v=005'
			/>
			<meta name='theme-color' content='#ffffff' />
		</Head>
		<body className='font-sans bg-incredible-dark-500'>
			<Main />
			<NextScript />
		</body>
	</Html>
)

export default Document
