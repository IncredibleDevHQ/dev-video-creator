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

import crypto from 'crypto'
import { z } from 'zod'
import env from '../env.server'

export type EnvType = {
	[key: string]: string
}

const validateEnvs = (envs: any) => {
	const envSchema = z.object({
		WEBHOOK_SECRET: z.string(),
		NODE_ENV: z.string(),
		DATABASE_URL: z.string(),

		LIVEBLOCKS_API_KEY: z.string(),
		LIVEBLOCKS_PUBLIC_KEY: z.string(),
		CUSTOMERIO_TRANSACTIONAL_APP_API_KEY: z.string(),
		REDIS_ENDPOINT: z.string(),
		REDIS_PORT: z.string(),
		REDIS_PASSWORD: z.string(),
		AGORA_APP_ID: z.string(),
		AGORA_APP_CERTIFICATE: z.string(),

		NEXT_API_BASE_URL: z.string(),
		NEXT_STUDIO_BASE_URL: z.string(),
		NEXT_PUBLIC_BASE_URL: z.string(),
		INTEGRATIONS_URL: z.string(),

		MUX_TOKEN_ID: z.string(),
		MUX_TOKEN_SECRET: z.string(),
		MUX_SIGNING_SECRET: z.string(),

		UNSPLASH_ACCESS_KEY: z.string(),

		TOKENIZE_ENDPOINT: z.string(),
		TOKENIZE_SECRET: z.string(),

		SECURITY_DYN_LINK_DOMAIN: z.string(),

		AWS_ACCESS_KEY_ID: z.string(),
		AWS_SECRET_ACCESS_KEY: z.string(),

		AWS_MEDIA_CONVERT_REGION: z.string(),
		AWS_MEDIA_CONVERT_ENDPOINT: z.string(),

		AWS_S3_UPLOAD_BUCKET: z.string(),

		AWS_MEDIA_CONVERT_INPUT_BUCKET_URL: z.string(),
		AWS_MEDIA_CONVERT_QUEUE: z.string(),
		AWS_MEDIA_CONVERT_ROLE_ARN: z.string(),
		AWS_MEDIA_CONVERT_MAX_BITRATE: z.string(),
		AWS_MEDIA_CONVERT_OUTPUT_BUCKET_URL: z.string(),

		FIREBASE_SERVICE_CONFIG: z.string(),

		COOKIE_DOMAIN: z.string(),
		ALLOWED_EXT: z.string(),
	})

	const verified = envSchema.safeParse(envs)

	if (!verified.success) {
		throw new Error(
			`❌ Invalid environment variables:',
			${JSON.stringify(verified.error.format(), null, 4)}`
		)
	}
	return envs
}
const decryptEnvs = (encrypted: string): EnvType => {
	try {
		const algo = process.env.ENV_ENCRYPTION_ALGORITHM?.toString()
		const key = process.env.ENCRYPTION_KEY?.toString()
		const iv = process.env.IV?.toString()

		if (!key || !iv || !algo) {
			throw new Error('Invalid encryption configuration')
		}

		const decipher = crypto.createDecipheriv(
			algo || `aes-256-cbc`,
			key, // ENC_KEY
			iv // IV
		)

		let decrypted = decipher.update(encrypted, 'base64', 'utf8')
		decrypted += decipher.final('utf8')

		const envs: EnvType = JSON.parse(decrypted)
		return validateEnvs(envs)
	} catch (e) {
		throw new Error(`Error decrypting envs ${e}`)
	}
}

const serverEnvs = decryptEnvs(env)

export default serverEnvs
