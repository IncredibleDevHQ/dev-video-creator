declare global {
	namespace NodeJS {
		interface ProcessEnv {
			NEXT_PUBLIC_CDN_URL: string
			NEXT_PUBLIC_EMBED_URL: string
			DATABASE_URL: string
		}
	}
}

export {}
