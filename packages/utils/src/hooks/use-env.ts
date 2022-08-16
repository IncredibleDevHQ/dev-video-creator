const getEnv = () => ({
	env: process.env.NEXT_PUBLIC_DEPLOY_ENV,
	agora: {
		appId: process.env.NEXT_PUBLIC_AGORA_APP_ID,
	},
	api: process.env.NEXT_PUBLIC_API_ENDPOINT,
	storage: {
		cdn: process.env.NEXT_PUBLIC_CDN_URL,
	},
	client: {
		publicUrl: process.env.NEXT_PUBLIC_PUBLIC_URL,
		embedPlayerUrl: process.env.NEXT_PUBLIC_EMBED_PLAYER_BASE_URL,
		tokenizerUrl: process.env.NEXT_PUBLIC_TOKENIZE_ENDPOINT,
	},
	hocuspocus: process.env.NEXT_PUBLIC_HOCUSPOCUS_SERVER,
	liveblocks: {
		publicKey: process.env.NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY,
	},
	googleFontsApiKey: process.env.NEXT_PUBLIC_GOOGLE_FONTS_API_KEY,
	giphyApiKey: process.env.NEXT_PUBLIC_GIPHY_API_KEY,
	logrocketAppId: process.env.NEXT_PUBLIC_LOGROCKET_APP_ID,
	sentry: {
		dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
		enabled: process.env.NEXT_PUBLIC_DEPLOY_ENV !== 'develop',
	},
	segment: process.env.NEXT_PUBLIC_SEGMENT_WATCH_ID,
	googleAnalytics: process.env.NEXT_PUBLIC_GA_TRACKING_CODE,
	firebaseConfig: JSON.parse(
		(process.env.NEXT_PUBLIC_FIREBASE_CONFIG as string) || '{}'
	),
})

const useEnv = () => getEnv()

export { useEnv, getEnv }
