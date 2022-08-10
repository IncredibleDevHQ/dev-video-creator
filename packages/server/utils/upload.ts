import mime from 'mime'
import serverEnvs from './env'

const allowedExtensions = serverEnvs.ALLOWED_EXT?.split(',') || []

const isKeyAllowed = async (key: string) => {
	const ext = key.split('.').pop()?.trim()
	if (!ext) return { ext: null, valid: false }

	return {
		ext: ext.toString(),
		mime: mime.getType(ext)?.toString(),
		valid: allowedExtensions.includes(ext),
	}
}

// eslint-disable-next-line import/prefer-default-export
export { isKeyAllowed }
