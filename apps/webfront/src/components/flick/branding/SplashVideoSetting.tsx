/* eslint-disable react/jsx-props-no-spreading */
import { cx } from '@emotion/css'
import { useState, useRef, useEffect } from 'react'
import Dropzone from 'react-dropzone'
import { FiLoader, FiUploadCloud } from 'react-icons/fi'
import { IoCloseCircle } from 'react-icons/io5'
import { BrandingInterface } from 'src/utils/configs'
import { UploadType } from 'utils/src/enums'
import { Heading, Text } from 'ui/src'
import { useUploadFile } from 'utils/src'

const SplashVideoSetting = ({
	branding,
	setBranding,
}: {
	branding: BrandingInterface
	setBranding: (branding: BrandingInterface) => void
}) => {
	const [uploadFile] = useUploadFile()

	const [fileUploading, setFileUploading] = useState(false)
	const [outroFileUploading, setOutroFileUploading] = useState(false)

	const [hover, setHover] = useState(false)
	const videoRef = useRef<HTMLVideoElement>(null)

	useEffect(() => {
		if (!videoRef.current) return
		if (hover) {
			videoRef.current.play()
		} else {
			videoRef.current.pause()
			videoRef.current.currentTime = 0
		}
	}, [hover])

	const handleUploadFile = async (files: File[], isIntro: boolean) => {
		const file = files?.[0]
		if (!file) return

		if (isIntro) {
			setFileUploading(true)
		} else {
			setOutroFileUploading(true)
		}

		const { url } = await uploadFile({
			extension: file.name.split('.').pop() as any,
			file,
			tag: UploadType.Brand,
			meta: {
				brandId: branding.id,
			},
		})

		setFileUploading(false)
		setOutroFileUploading(false)

		if (isIntro) {
			setBranding({
				...branding,
				branding: { ...branding.branding, introVideoUrl: url },
			})
		} else {
			setBranding({
				...branding,
				branding: { ...branding.branding, outroVideoUrl: url },
			})
		}
	}

	return (
		<div className='flex flex-col'>
			<Heading textStyle='extraSmallTitle'>Intro Video</Heading>
			{!branding.branding?.introVideoUrl ? (
				<Dropzone
					onDrop={files => handleUploadFile(files, true)}
					accept={{ 'video/*': [] }}
					maxFiles={1}
				>
					{({ getRootProps, getInputProps }) => (
						<div
							tabIndex={-1}
							onKeyUp={() => {}}
							role='button'
							className='flex flex-col items-center p-4 my-2 border border-gray-200 border-dashed rounded-md cursor-pointer'
							{...getRootProps()}
						>
							<input {...getInputProps()} />
							{fileUploading ? (
								<FiLoader className={cx('animate-spin my-6')} size={16} />
							) : (
								<>
									<FiUploadCloud size={18} className='my-2 text-gray-600' />

									<div className='z-50 text-center '>
										<Text textStyle='bodySmall'>Drag and drop or</Text>
										<Text textStyle='bodySmall' className='font-semibold'>
											browse
										</Text>
									</div>
								</>
							)}
						</div>
					)}
				</Dropzone>
			) : (
				<div
					className='relative flex items-center justify-center w-1/2 h-16 mt-2 border border-gray-200 rounded-md cursor-pointer'
					onMouseEnter={() => setHover(true)}
					onMouseLeave={() => setHover(false)}
				>
					<IoCloseCircle
						className='absolute top-0 right-0 text-red-500 -m-1.5 cursor-pointer block z-10 bg-white rounded-full'
						size={16}
						onClick={() => {
							setBranding({
								...branding,
								branding: {
									...branding.branding,
									introVideoUrl: undefined,
								},
							})
						}}
					/>
					<video
						ref={videoRef}
						className='object-cover rounded-sm '
						src={branding.branding?.introVideoUrl || ''}
						muted
					/>
				</div>
			)}
			<Heading textStyle='extraSmallTitle' className='mt-8'>
				Outro Video
			</Heading>
			{!branding.branding?.outroVideoUrl ? (
				<Dropzone
					onDrop={files => handleUploadFile(files, false)}
					accept={{ 'video/*': [] }}
					maxFiles={1}
				>
					{({ getRootProps, getInputProps }) => (
						<div
							tabIndex={-1}
							onKeyUp={() => {}}
							role='button'
							className='flex flex-col items-center p-4 my-2 border border-gray-200 border-dashed rounded-md cursor-pointer'
							{...getRootProps()}
						>
							<input {...getInputProps()} />
							{outroFileUploading ? (
								<FiLoader className={cx('animate-spin my-6')} size={16} />
							) : (
								<>
									<FiUploadCloud size={18} className='my-2 text-gray-600' />

									<div className='z-50 text-center '>
										<Text textStyle='bodySmall'>Drag and drop or</Text>
										<Text textStyle='bodySmall' className='font-semibold'>
											browse
										</Text>
									</div>
								</>
							)}
						</div>
					)}
				</Dropzone>
			) : (
				<div
					className='relative flex items-center justify-center w-1/2 h-16 mt-2 border border-gray-200 rounded-md cursor-pointer'
					onMouseEnter={() => setHover(true)}
					onMouseLeave={() => setHover(false)}
				>
					<IoCloseCircle
						className='absolute top-0 right-0 text-red-500 -m-1.5 cursor-pointer block z-10 bg-white rounded-full'
						size={16}
						onClick={() => {
							setBranding({
								...branding,
								branding: {
									...branding.branding,
									outroVideoUrl: undefined,
								},
							})
						}}
					/>
					<video
						ref={videoRef}
						className='object-cover rounded-sm '
						src={branding.branding?.outroVideoUrl || ''}
						muted
					/>
				</div>
			)}
		</div>
	)
}

export default SplashVideoSetting
