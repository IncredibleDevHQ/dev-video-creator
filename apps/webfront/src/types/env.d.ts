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
