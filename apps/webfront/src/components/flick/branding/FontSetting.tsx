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

/* eslint-disable react/jsx-props-no-spreading */
import { cx } from '@emotion/css'
import { Popover } from '@headlessui/react'
import { useState } from 'react'
import Dropzone from 'react-dropzone'
import { BiFileBlank } from 'react-icons/bi'
import { FiLoader, FiUploadCloud } from 'react-icons/fi'
import { IoCloseOutline, IoCloseCircle } from 'react-icons/io5'
import { BrandingInterface, BrandingJSON } from 'src/utils/configs'
import { emitToast, Heading, Button, Text } from 'ui/src'
import { useUploadFile } from 'utils/src'
import { UploadType } from 'utils/src/enums'
import trpc from '../../../server/trpc'
import CustomFontPicker, { IFont } from './CustomFontPicker'

const initialValue: BrandingJSON = {
	font: {
		heading: {
			family: 'Gilroy',
			type: 'custom',
		},
		body: {
			family: 'Inter',
			type: 'custom',
		},
	},
}

const FontSetting = ({
	branding,
	setBranding,
}: {
	branding: BrandingInterface
	setBranding: (branding: BrandingInterface) => void
}) => {
	const { data, refetch } = trpc.useQuery(['util.fonts'])
	const { mutateAsync: addFont, isLoading: loading } = trpc.useMutation([
		'util.createFont',
	])
	const [showUploadFont, setShowUploadFont] = useState(false)
	const [headingOrBody, setHeadingOrBody] = useState<'heading' | 'body'>(
		'heading'
	)

	const [familyName, setFamilyName] = useState('')
	const [url, setUrl] = useState('')
	const [fileName, setFileName] = useState('')

	const [fontUploading, setFontUploading] = useState(false)

	const [uploadFile] = useUploadFile()

	const handleAddFont = async () => {
		try {
			await addFont({
				url,
				family: familyName,
			})
			setUrl('')
			setShowUploadFont(false)
			refetch()
			setBranding({
				...branding,
				branding: {
					...branding.branding,
					font: {
						...branding?.branding?.font,
						[headingOrBody]: {
							...branding?.branding?.font?.[headingOrBody],
							family: familyName,
							type: 'custom',
							url,
						},
					},
				},
			})
		} catch (e) {
			emitToast('Could not add font', {
				type: 'error',
			})
		}
	}

	const handleUploadFile = async (files: File[]) => {
		try {
			const file = files?.[0]
			if (!file) return

			setFontUploading(true)
			const { url: uploadedUrl } = await uploadFile({
				extension: file.name.split('.').pop() as any,
				file,
				tag: UploadType.Brand,
				meta: {
					brandId: branding.id,
				},
			})
			setUrl(uploadedUrl)
			setFileName(file.name)
		} catch (e) {
			emitToast('Failed to upload font', {
				type: 'error',
			})
		} finally {
			setFontUploading(false)
		}
	}

	return (
		<div className='flex flex-col'>
			<Heading textStyle='extraSmallTitle' className='mb-2'>
				Heading
			</Heading>
			<Popover as='div' className='relative'>
				<CustomFontPicker
					showUploadFont={() => {
						setShowUploadFont(true)
						setHeadingOrBody('heading')
					}}
					customFonts={
						data?.map(
							f =>
								({
									family: f.family,
									type: 'custom',
									url: f.url,
								} as IFont)
						) || []
					}
					activeFont={
						branding.branding?.font?.heading ||
						(initialValue.font?.heading as IFont)
					}
					onChange={font => {
						setBranding({
							...branding,
							branding: {
								...branding.branding,
								font: {
									...branding?.branding?.font,
									heading: {
										type: font.type,
										family: font.family,
										url: font.url,
									},
								},
							},
						})
					}}
				/>
				{showUploadFont && (
					<Popover.Panel
						static
						as='div'
						style={{
							width: '300px',
						}}
						className='absolute top-0 right-56 px-4 py-2 pb-4 mt-1 mr-6 bg-white border border-gray-200 rounded-sm shadow-sm'
					>
						<IoCloseOutline
							className='ml-auto cursor-pointer'
							size={16}
							onClick={() => setShowUploadFont(false)}
						/>
						<Heading textStyle='extraSmallTitle'>Custom font</Heading>
						<input
							placeholder='Font family name'
							className='w-full mt-4 text-size-xs font-body border rounded-sm px-2 py-1.5 outline-none focus:border-green-600'
							value={familyName}
							onChange={e => setFamilyName(e.currentTarget.value)}
						/>
						{!url ? (
							<Dropzone
								onDrop={handleUploadFile}
								accept={{ '.woff': [], '.woff2': [] }}
								maxFiles={1}
							>
								{({ getRootProps, getInputProps }) => (
									<div
										tabIndex={-1}
										onKeyUp={() => {}}
										role='button'
										className='flex flex-col items-center p-3 mt-2 mb-2 border border-gray-200 border-dashed rounded-md cursor-pointer'
										{...getRootProps()}
									>
										<input {...getInputProps()} />
										{fontUploading && (
											<FiLoader className={cx('animate-spin my-6')} size={16} />
										)}
										{!fontUploading && !url && (
											<>
												<FiUploadCloud
													size={18}
													className='my-2 text-gray-600'
												/>

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
							<div className='relative flex items-center w-full p-2 mt-2 bg-gray-100 rounded-sm'>
								<IoCloseCircle
									className='absolute top-0 right-0 text-red-500 -m-1.5 cursor-pointer block z-10 bg-white rounded-full'
									size={16}
									onClick={() => {
										setUrl('')
									}}
								/>
								<BiFileBlank size={21} className='flex-shrink-0 mr-2' />
								<Text className='text-sm text-gray-600 truncate font-body'>
									{fileName}
								</Text>
							</div>
						)}
						<Button
							onClick={handleAddFont}
							disabled={loading || !familyName || !url}
							loading={loading}
							className='w-full max-w-none mt-4'
						>
							Add font
						</Button>
					</Popover.Panel>
				)}
			</Popover>

			<Heading textStyle='extraSmallTitle' className='mt-10 mb-2'>
				Body
			</Heading>
			<CustomFontPicker
				showUploadFont={() => {
					setShowUploadFont(true)
					setHeadingOrBody('body')
				}}
				customFonts={
					data?.map(
						f =>
							({
								family: f.family,
								type: 'custom',
								url: f.url,
							} as IFont)
					) || []
				}
				activeFont={
					branding.branding?.font?.body || (initialValue.font?.body as IFont)
				}
				onChange={font => {
					setBranding({
						...branding,
						branding: {
							...branding.branding,
							font: {
								...branding?.branding?.font,
								body: {
									type: font.type,
									family: font.family,
									url: font.url,
								},
							},
						},
					})
				}}
			/>
		</div>
	)
}

export default FontSetting
