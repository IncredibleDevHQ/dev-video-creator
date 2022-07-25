const defaultConfig = require('tailwindcss/defaultConfig')
const colors = require('tailwindcss/colors')
const formsPlugin = require('@tailwindcss/forms')
const aspectRatioPlugin = require('@tailwindcss/aspect-ratio')
const typographyPlugin = require('@tailwindcss/typography')
const lineClampPlugin = require('@tailwindcss/line-clamp')

module.exports = {
	content: [
		'../../packages/ui/src/**/*.{ts,tsx}',
		'../../packages/editor/src/**/*.{ts,tsx}',
		'../../packages/icanvas/src/**/*.{ts,tsx}',
		'./index.html',
		'./src/**/*.{vue,js,ts,jsx,tsx}',
	],
	theme: {
		screens: {
			xs: '320px',
			...defaultConfig.theme.screens,
		},
		fontFamily: {
			main: ['Gilroy', ...defaultConfig.theme.fontFamily.sans],
			body: ['InterBody', ...defaultConfig.theme.fontFamily.sans],
		},
		fontSize: {
			'size-2xl': ['32px', '40px'],
			'size-xl': ['28px', '32px'],
			'size-lg': ['20px', '28px'],
			'size-md': ['16px', '24px'],
			'size-sm-title': ['14px', '20px'],
			'size-sm': ['14px', '16px'],
			'size-xs-title': ['12px', '20px'],
			'size-xs': ['12px', '16px'],
			'size-xxs': ['11px', '16px'],
		},
		extend: {
			borderRadius: {
				sm: '4px',
			},
			colors: {
				gray: {
					...colors.zinc,
				},
				'cool-gray': {
					...colors.gray,
				},
				dark: {
					100: '#383b40',
					200: '#2e2f34',
					300: '#28292d',
					400: '#1f2024',
					500: '#121212',
					title: {
						DEFAULT: 'rgba(255, 255, 255, 0.9);',
						200: '#929397',
					},
					body: {
						100: '#C5C5C5',
					},
				},
			},
		},
	},
	experimental: { optimizeUniversalDefaults: true },
	plugins: [formsPlugin, aspectRatioPlugin, typographyPlugin, lineClampPlugin],
}
