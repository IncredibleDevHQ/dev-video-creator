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
