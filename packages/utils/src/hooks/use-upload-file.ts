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
		const key = `${nanoid()}.${extension}`
		const options = {
			method: 'POST',
			url: '/api/trpc/util.getUploadUrl',
			headers: {
				'Content-Type': 'application/json',
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

		if (!res.data?.json.success) {
			throw new Error('Could not get upload URL')
		}

		const url = res.data?.json.url

		if (!url) {
			throw Error('The server did not return an upload URL.')
		}

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
