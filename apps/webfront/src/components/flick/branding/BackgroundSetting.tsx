/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable jsx-a11y/media-has-caption */
/* eslint-disable @next/next/no-img-element */
import { css, cx } from '@emotion/css'
import { Popover } from '@headlessui/react'
import { useState, useRef, useEffect } from 'react'
import Dropzone from 'react-dropzone'
import { FiLoader, FiUploadCloud } from 'react-icons/fi'
import { IoCloseOutline, IoCloseCircle, IoAddOutline } from 'react-icons/io5'
import { BrandingInterface } from 'src/utils/configs'
import { Heading, Text } from 'ui/src'
import { HexColorInput, HexColorPicker } from 'react-colorful'
import { useUploadFile } from 'utils/src'

const colorPickerStyle = css`
	.react-colorful__saturation {
		border-radius: 4px;
		width: 268px;
	}

	.react-colorful__hue {
		margin-top: 10px;
		height: 16px;
		border-radius: 4px;
		width: 268px;
	}

	.react-colorful__saturation-pointer {
		width: 16px;
		height: 16px;
	}

	.react-colorful__hue-pointer {
		width: 16px;
		height: 16px;
	}
`

const BackgroundSetting = ({
	branding,
	setBranding,
}: {
	branding: BrandingInterface
	setBranding: (branding: BrandingInterface) => void
}) => {
	const [colorPicker, setColorPicker] = useState(false)
	const [uploadFile] = useUploadFile()
	const [hover, setHover] = useState(false)
	const [fileUploading, setFileUploading] = useState(false)

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

	const handleColorChange = (color: string) => {
		setBranding({
			...branding,
			branding: {
				...branding.branding,
				background: {
					...branding?.branding?.background,
					type:
						branding?.branding?.background?.type === 'video' ||
						branding?.branding?.background?.type === 'image'
							? branding?.branding?.background?.type
							: 'color',
					color: {
						...branding?.branding?.background?.color,
						primary: color,
					},
				},
			},
		})
	}

	const handleUploadFile = async (files: File[]) => {
		const file = files?.[0]
		if (!file) return

		let fileType: 'image' | 'video' = 'image'
		if (file.type.startsWith('image')) fileType = 'image'
		else fileType = 'video'

		setFileUploading(true)
		const { url } = await uploadFile({
			extension: file.name.split('.').pop() as any,
			file,
		})

		setFileUploading(false)
		setBranding({
			...branding,
			branding: {
				...branding.branding,
				background: {
					...branding?.branding?.background,
					type: fileType,
					url,
				},
			},
		})
	}

	return (
		<div className='flex flex-col'>
			<Heading textStyle='extraSmallTitle'>Background</Heading>
			{/* <Tooltip
				content={

				}
				isOpen={colorPicker}
				setIsOpen={setColorPicker}
				placement='left-start'
			> */}
			<Popover as='div' className='relative'>
				<Popover.Button
					onClick={() => setColorPicker(!colorPicker)}
					style={{
						backgroundColor:
							branding.branding?.background?.type === 'color'
								? branding.branding?.background?.color?.primary
								: '#fff',
					}}
					onMouseEnter={() => setHover(true)}
					onMouseLeave={() => setHover(false)}
					className='relative flex items-center justify-center w-1/2 h-16 mt-2 rounded-sm cursor-pointer ring-1 ring-offset-1 ring-gray-100'
				>
					{branding.branding?.background && (
						<IoCloseCircle
							className='absolute top-0 right-0 text-red-500 -m-1.5 cursor-pointer block z-10 bg-white rounded-full'
							size={16}
							onClick={e => {
								e.stopPropagation()
								setBranding({
									...branding,
									branding: {
										...branding.branding,
										background: undefined,
									},
								})
							}}
						/>
					)}
					{!branding.branding?.background && (
						<IoAddOutline size={21} className='text-gray-500' />
					)}
					{branding.branding?.background?.type === 'image' && (
						<img
							src={branding.branding?.background?.url || ''}
							alt='backgroundImage'
							className='object-contain w-full h-full rounded-md'
						/>
					)}
					{branding.branding?.background?.type === 'video' && (
						<video
							ref={videoRef}
							className='object-cover w-full h-full rounded-sm'
							src={branding.branding?.background?.url || ''}
							muted
						/>
					)}
				</Popover.Button>
				<Popover.Panel
					style={{
						width: '300px',
					}}
					className='absolute top-0 right-56 px-4 py-2 pb-4 mt-1 mr-6 bg-white border border-gray-200 rounded-sm shadow-sm'
				>
					<IoCloseOutline
						className='ml-auto cursor-pointer'
						size={16}
						onClick={() => setColorPicker(false)}
					/>
					<Heading textStyle='extraSmallTitle'>Custom color</Heading>
					<HexColorPicker
						className={cx('mt-2', colorPickerStyle)}
						color={branding.branding?.background?.color?.primary || '#000'}
						onChange={handleColorChange}
					/>
					<HexColorInput
						color={branding.branding?.background?.color?.primary || '#000'}
						className='w-full p-2 mt-3 text-size-xs text-center transition-colors bg-gray-100 rounded font-body focus:border-brand focus:outline-none'
						onChange={handleColorChange}
					/>
					<div className='my-4 border-t border-gray-200' />
					{branding.branding?.background?.url ? (
						<div
							className='relative rounded-sm ring-1 ring-offset-1 ring-gray-100'
							style={{ height: '150px', width: '268px' }}
						>
							<IoCloseCircle
								className='absolute top-0 right-0 text-red-500 -m-1.5 cursor-pointer block z-10 bg-white rounded-full'
								size={16}
								onClick={() => {
									setBranding({
										...branding,
										branding: {
											...branding.branding,
											background: undefined,
										},
									})
								}}
							/>
							{branding.branding?.background?.type === 'image' ? (
								<img
									src={branding.branding?.background?.url || ''}
									alt='backgroundImage'
									className='object-contain w-full h-full rounded-md'
								/>
							) : (
								<video
									className='object-cover w-full h-full rounded-sm'
									src={branding.branding?.background?.url || ''}
									controls
								/>
							)}
						</div>
					) : (
						<>
							<Heading textStyle='extraSmallTitle'>Upload image</Heading>
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
										className='flex flex-col items-center p-3 mt-2 border border-gray-200 border-dashed rounded-md cursor-pointer'
										{...getRootProps()}
									>
										<input {...getInputProps()} />
										{fileUploading ? (
											<FiLoader className={cx('animate-spin my-6')} size={16} />
										) : (
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
						</>
					)}
				</Popover.Panel>
			</Popover>
			{/* </Tooltip> */}
		</div>
	)
}

export default BackgroundSetting
