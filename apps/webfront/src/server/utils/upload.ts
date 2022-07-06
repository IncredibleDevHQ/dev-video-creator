import { fileTypeFromFile } from 'file-type'
import serverEnvs from 'src/utils/env'

const allowedExtensions = serverEnvs.ALLOWED_EXT?.split(',') || []

const isKeyAllowed = async (key: string) => {
	const fileData = await fileTypeFromFile(key)
	if (!fileData) return { ext: null, valid: false }
	return {
		ext: fileData.ext.toString(),
		mime: fileData.mime.toString(),
		valid: allowedExtensions.includes(fileData.ext),
	}
}

// eslint-disable-next-line import/prefer-default-export
export { isKeyAllowed }
