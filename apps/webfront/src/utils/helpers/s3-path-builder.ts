import { UploadType } from 'utils/src/enums'

const getStoragePath = (
	userSub: string,
	uploadType: UploadType,
	meta: any
): string | Error => {
	switch (uploadType) {
		/*
       User Assets such as notebook image uploads, screenshots,video uploads to notebook etc.
      */
		case UploadType.Asset:
			return meta.flickId && meta.fragmentId
				? `story/${meta.flickId}/${meta.fragmentId}/assets/`
				: new Error('Invalid meta') // config.aws.s3.assetPrefix
		/*
        User Brand Assets such as logos and bg images
      */
		case UploadType.Brand:
			if (meta?.brandId) return `user/${userSub}/brand/${meta.brandId}/` // config.aws.s3.brandPrefix;
			return new Error('Invalid brand id')

		/*
        Recorded Block webm's
      */
		case UploadType.Block:
			if (meta?.blockId && meta?.fragmentId && meta?.flickId)
				return `story/${meta.flickId}/${meta.fragmentId}/${meta.recordingId}/` // config.aws.s3.blockPrefix;
			return new Error('Invalid meta when trying to save block')

		/*
            For storing user generated thumbnail
        */
		case UploadType.Thumbnail:
			return meta.flickId
				? `story/${meta.flickId}/thumbnail/` // config.aws.s3.thumbnailPrefix;
				: new Error('Invalid thumbnail meta')

		case UploadType.Profile:
			return meta.flickId
				? `user/${userSub}/profile/`
				: new Error('Invalid Profile meta')

		default:
			throw new Error('Invalid upload type')
	}
}

export default getStoragePath
