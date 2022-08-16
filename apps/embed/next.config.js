const withTM = require('next-transpile-modules')([
	'ui',
	'editor',
	'icanvas',
	'utils',
	'server',
	'prisma-orm',
	'@vime/core',
	'@vime/react',
])

const ContentSecurityPolicy = `
    default-src 'self' * localhost;
    script-src 'self' 'unsafe-eval' 'unsafe-inline' * *.youtube.com *.twitter.com *.google.com *.gstatic.com *.google-analytics.com *.segment.com localhost;
    child-src * *.youtube.com *.twitter.com *.firebaseapp.com *.google.com blob: localhost;
    style-src 'self' 'unsafe-inline' localhost;
    img-src * blob: data: localhost;
    media-src 'self' *.incredible.dev localhost;
    connect-src * localhost;
    font-src 'self' data: localhost;
    frame-src * localhost;
    frame-ancestors * localhost;
  `

// All security headers for the entire application
const securityHeaders = [
	// This header controls how much information the browser includes when navigating from the current website (origin) to another.
	{
		key: 'Referrer-Policy',
		value: 'origin-when-cross-origin',
	},
	// This header allows you to control which features and APIs can be used in the browser.
	{
		key: 'Permissions-Policy',
		value: 'camera=(), microphone=(), geolocation=()',
	},
	// This header informs browsers it should only be accessed using HTTPS, instead of using HTTP.
	// Using the configuration below, all present and future subdomains will use HTTPS for a max-age of 1 years.
	// This blocks access to pages or subdomains that can only be served over HTTP.
	{
		key: 'Strict-Transport-Security',
		value: 'max-age=31536000; includeSubDomains; preload',
	},
	// This header prevents the browser from attempting to guess the type of content if the Content-Type header is not explicitly set.
	// This can prevent XSS exploits for websites that allow users to upload and share files.
	// For example, a user trying to download an image, but having it treated as a different Content-Type like an executable, which could be malicious.
	// This header also applies to downloading browser extensions. The only valid value for this header is `nosniff`.
	{
		key: 'X-Content-Type-Options',
		value: 'nosniff',
	},
	// This header indicates whether the site should be allowed to be displayed within an iframe. This can prevent against clickjacking attacks.
	{
		key: 'X-Frame-Options',
		value: 'SAMEORIGIN',
	},
	// This header controls DNS prefetching, allowing browsers to proactively perform domain name resolution on external links, images, CSS, JavaScript, and more.
	// This prefetching is performed in the background, so the DNS is more likely to be resolved by the time the referenced items are needed.
	// This reduces latency when the user clicks a link.
	{
		key: 'X-DNS-Prefetch-Control',
		value: 'on',
	},
	// This header helps prevent cross-site scripting (XSS), clickjacking and other code injection attacks.
	// Content Security Policy (CSP) can specify allowed origins for content including scripts, stylesheets, images, fonts, objects, media (audio, video), iframes, and more.
	// MDN: https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP
	{
		key: 'Content-Security-Policy',
		value: ContentSecurityPolicy.replace(/\n/g, ''),
	},
]

/** @type {import('next').NextConfig} */
module.exports = withTM({
	// For importing SVG as components in code.
	webpack(config) {
		config.module.rules.push({
			test: /\.svg$/,
			use: ['@svgr/webpack'],
		})
		return config
	},

	// These are environment variables that are used specifically by AWS Amplify
	env: {
		NEXT_PUBLIC_CDN_URL: process.env.NEXT_PUBLIC_CDN_URL,
		NEXT_PUBLIC_EMBED_URL: process.env.NEXT_PUBLIC_EMBED_URL,
	},

	reactStrictMode: true,

	// Add security headers
	async headers() {
		return [
			{
				// Apply these headers to all routes.
				source: '/(.*)',
				headers: securityHeaders,
			},
		]
	},

	// ESLint
	eslint: {
		dirs: [
			'pages',
			'components',
			'hooks',
			'layouts',
			'stores',
			'types',
			'utils',
		],
	},
})
