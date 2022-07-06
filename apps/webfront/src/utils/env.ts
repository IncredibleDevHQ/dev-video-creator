import crypto from 'crypto'

export type EnvType = {
	[key: string]: string
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
		return envs
	} catch (e) {
		throw new Error(`Invalid encrypted env. Error: ${e}`)
	}
}

export default decryptEnvs
