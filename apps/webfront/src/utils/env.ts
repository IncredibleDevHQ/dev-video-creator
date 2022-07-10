import crypto from 'crypto'
import env from '../../env.webfront'

export type EnvType = {
	[key: string]: string
}

// TODO: Implement env validation
const validateEnvs = (envs: any) =>
	// const envSchema = z.object({
	// 	DATABASE_URL: z.string().url(),
	// 	NODE_ENV: z.enum(['development', 'test', 'production']),
	// })

	// const verified = envSchema.safeParse(process.env)

	// if (!verified.success) {
	// 	console.error(
	// 		'❌ Invalid environment variables:',
	// 		JSON.stringify(verified.error.format(), null, 4)
	// 	)
	// 	// process.exit(1)
	// }
	envs

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
		throw new Error(`Invalid encrypted env. ${e}`)
	}
}

const serverEnvs = decryptEnvs(env)

export default serverEnvs
