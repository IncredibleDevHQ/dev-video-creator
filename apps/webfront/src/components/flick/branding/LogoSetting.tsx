/* eslint-disable @next/next/no-img-element */
/* eslint-disable react/jsx-props-no-spreading */
import { cx } from '@emotion/css'
import { useRef, useState } from 'react'
import Dropzone from 'react-dropzone'
import { FiLoader, FiUploadCloud } from 'react-icons/fi'
import { IoCloseCircle } from 'react-icons/io5'
import { BrandingInterface } from 'src/utils/configs'
import { Heading, Text } from 'ui/src'
import { useUploadFile } from 'utils/src'

const LogoSetting = ({
	branding,
	setBranding,
}: {
	branding: BrandingInterface
	setBranding: (branding: BrandingInterface) => void
}) => {
	const inputRef = useRef<HTMLInputElement | null>(null)
	const [uploadFile] = useUploadFile()

	const [fileUploading, setFileUploading] = useState(false)

	const handleUploadFile = async (files: File[]) => {
		const file = files?.[0]
		if (!file) return

		setFileUploading(true)
		const { url } = await uploadFile({
			extension: file.name.split('.').pop() as any,
			file,
		})

		setFileUploading(false)
		setBranding({ ...branding, branding: { ...branding.branding, logo: url } })
	}

	return (
		<div className='flex flex-col'>
			<Heading textStyle='extraSmallTitle' className='font-bold'>
				Logo
			</Heading>
			{!branding.branding?.logo ? (
				<Dropzone
					onDrop={handleUploadFile}
					accept={{ 'image/*': [] }}
					maxFiles={1}
				>
					{({ getRootProps, getInputProps }) => (
						<div
							tabIndex={-1}
							onKeyUp={() => {}}
							role='button'
							className='flex flex-col items-center p-4 my-3 border border-gray-200 border-dashed rounded-md cursor-pointer'
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
				<button
					type='button'
					onClick={() => inputRef.current?.click()}
					style={{ background: branding.branding?.logo }}
					className='relative w-1/2 h-16 p-4 mt-2 border border-gray-200 rounded-md'
				>
					<IoCloseCircle
						className='absolute top-0 right-0 text-red-500 -m-1.5 cursor-pointer block z-10 bg-white rounded-full'
						size={16}
						onClick={() => {
							setBranding({
								...branding,
								branding: {
									...branding.branding,
									logo: undefined,
								},
							})
						}}
					/>
					{branding.branding?.logo && (
						<img
							className='object-contain w-full h-full'
							src={branding.branding.logo}
							alt='Logo'
						/>
					)}
				</button>
			)}
		</div>
	)
}

export default LogoSetting
