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
			if (
				meta?.blockId &&
				meta?.fragmentId &&
				meta?.flickId &&
				meta?.recordingId
			)
				return `story/${meta.flickId}/${meta.fragmentId}/${meta.recordingId}/` // config.aws.s3.blockPrefix;
			return new Error(
				`Invalid meta when trying to save block. meta: ${JSON.stringify(
					meta
				)}.\n`
			)

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
