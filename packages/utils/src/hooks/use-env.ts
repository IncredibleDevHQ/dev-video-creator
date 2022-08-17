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

const getEnv = () => ({
	env: process.env.NEXT_PUBLIC_DEPLOY_ENV,
	agora: {
		appId: process.env.NEXT_PUBLIC_AGORA_APP_ID,
	},
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
	firebaseConfig: JSON.parse(
		(process.env.NEXT_PUBLIC_FIREBASE_CONFIG as string) || '{}'
	),
})

const useEnv = () => getEnv()

export { useEnv, getEnv }
