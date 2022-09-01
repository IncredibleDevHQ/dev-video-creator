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

declare global {
	namespace NodeJS {
		interface ProcessEnv {
			NEXT_PUBLIC_DEPLOY_ENV: string
			NEXT_PUBLIC_API_ENDPOINT: string
			NEXT_PUBLIC_PUBLIC_URL: string
			NEXT_PUBLIC_CDN_URL: string
			NEXT_PUBLIC_EMBED_PLAYER_BASE_URL: string
			NEXT_PUBLIC_HOCUSPOCUS_SERVER: string
			NEXT_PUBLIC_GIPHY_API_KEY: string
			NEXT_PUBLIC_GOOGLE_FONTS_API_KEY: string
			NEXT_PUBLIC_AGORA_APP_ID: string
			NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY: string
			NEXT_PUBLIC_LOGROCKET_APP_ID: string
			NEXT_PUBLIC_SENTRY_DSN: string
			NEXT_PUBLIC_GA_TRACKING_CODE: string
			NEXT_PUBLIC_SEGMENT_WATCH_ID: string
			NEXT_PUBLIC_HASURA_SERVER: string
			NEXT_PUBLIC_HASURA_WS_SERVER: string
			NEXT_PUBLIC_HASURA_REST: string
			TIPTAP_PRO_TOKEN: string
			HASURA_ADMIN_SECRET: string
			CUSTOMERIO_API_KEY: string
			CUSTOMERIO_SITE_ID: string
			CUSTOMERIO_APP_ID: string
			NEXT_PUBLIC_FIREBASE_CONFIG: string
			FIREBASE_SERVICE_CONFIG: string
			COOKIE_DOMAIN: string
			NEXT_PUBLIC_BASE_URL: string
		}
	}
}

export {}
