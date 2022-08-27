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
