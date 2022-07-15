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
