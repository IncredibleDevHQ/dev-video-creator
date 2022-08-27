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



/* eslint-disable @next/next/no-img-element */
/* eslint-disable react/jsx-props-no-spreading */
import { cx } from '@emotion/css'
import { useRef, useState } from 'react'
import Dropzone from 'react-dropzone'
import { FiLoader, FiUploadCloud } from 'react-icons/fi'
import { IoCloseCircle } from 'react-icons/io5'
import { BrandingInterface } from 'src/utils/configs'
import { UploadType } from 'utils/src/enums'
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
			tag: UploadType.Brand,
			meta: {
				brandId: branding.id,
			},
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
