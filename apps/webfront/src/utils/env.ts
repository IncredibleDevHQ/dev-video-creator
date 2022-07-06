import crypto from 'crypto'

const decryptEnvs = (encrypted: string) => {
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
	const decrypted = decipher.update(encrypted, 'base64', 'utf8')
	return decrypted + decipher.final('utf8')
}

export type EnvType = {
	[key: string]: string
}

const getEnvs = (encrypted: string): EnvType => {
	const decrypted = decryptEnvs(encrypted)
	try {
		const envs: EnvType = JSON.parse(decrypted)
		return envs
	} catch (e) {
		throw new Error('Invalid encrypted env')
	}
}

export default getEnvs
