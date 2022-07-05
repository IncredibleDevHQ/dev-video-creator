import fileExtension from 'file-extension'

const allowedExtensions = process.env.ALLOWED_EXT?.split(',') || []

const isKeyAllowed = async (key: string) => {
	const ext = await fileExtension(key)
	return { ext, valid: allowedExtensions.includes(ext) }
}

// eslint-disable-next-line import/prefer-default-export
export { isKeyAllowed }
