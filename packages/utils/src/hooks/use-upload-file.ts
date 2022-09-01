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

import { nanoid } from 'nanoid'
import axios from 'axios'
import mime from 'mime'
import { UploadType } from '../enums'
import { useEnv } from './use-env'

export type AllowedFileExtensions =
	| 'png'
	| 'jpg'
	| 'svg'
	| 'jpeg'
	| 'webp'
	| 'webm'
	| 'mp4'
	| 'mov'
	| 'ts'
	| 'm3u8'
	| 'json'
	| 'yaml'
	| 'woff'
	| 'woff2'

interface UploadFileProps {
	extension: AllowedFileExtensions
	file: Blob | File | Buffer
	tag: UploadType
	meta: {
		flickId?: string
		fragmentId?: string
		brandId?: string
		blockId?: string
		recordingId?: string
	}
	handleProgress?: ({
		workDone,
		percentage,
	}: {
		workDone: number
		percentage: number
	}) => void
}

export const useUploadFile = () => {
	const { storage } = useEnv()

	const uploadFile = async ({
		extension,
		file,
		tag,
		meta,
		handleProgress,
	}: UploadFileProps) => {
		let key = `${nanoid()}.${extension}`
		const options = {
			method: 'POST',
			url: '/api/trpc/util.getUploadUrl',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${localStorage.getItem('token')}`,
			},
			data: {
				json: {
					key,
					tag,
					meta,
				},
			},
		}
		const res = await axios.request(options)

		if (!res.data?.result.data.json.success) {
			throw new Error('Could not get upload URL')
		}

		const url = res.data?.result.data.json.url

		if (!url) {
			throw Error('The server did not return an upload URL.')
		}

		// NOTE: Update this to have the complete s3 path in key
		key = res.data?.result.data.json.object

		await axios({
			url,
			method: 'put',
			data: file,
			headers: {
				'Content-Type': mime.getType(extension) ?? '',
				'content-disposition': 'inline',
			},
			onUploadProgress: e => {
				const work = e.loaded / e.total
				handleProgress?.({
					workDone: work,
					percentage: Math.round(work * 100),
				})
			},
		})

		return { url: storage.cdn + key, uuid: key }
	}

	return [uploadFile]
}
