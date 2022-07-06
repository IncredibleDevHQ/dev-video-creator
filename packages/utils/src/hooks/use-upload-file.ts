import { nanoid } from 'nanoid'
import axios from 'axios'
import mime from 'mime'
import { useUploadFileMutation } from '../graphql/generated'
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
	handleProgress?: ({
		workDone,
		percentage,
	}: {
		workDone: number
		percentage: number
	}) => void
}

export const useUploadFile = () => {
	const [uploadFileMutation] = useUploadFileMutation()

	const { storage } = useEnv()

	const uploadFile = async ({
		extension,
		file,
		handleProgress,
	}: UploadFileProps) => {
		const key = `${nanoid()}.${extension}`
		const { data, errors } = await uploadFileMutation({ variables: { key } })
		if (errors) {
			throw errors[0]
		}

		const url = data?.UploadFile?.url

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
