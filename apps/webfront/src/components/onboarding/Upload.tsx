/* eslint-disable @next/next/no-img-element */
/* eslint-disable jsx-a11y/no-autofocus */
/* eslint-disable react/jsx-props-no-spreading */
import { cx } from '@emotion/css'
import React, { useContext, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { FiEdit2, FiLoader, FiUpload } from 'react-icons/fi'
import { emitToast, Heading, Button, Text } from 'ui/src'
import { useUploadFile, AllowedFileExtensions } from 'utils/src'
import { rippleAnimation } from './People'
import { OnBoardingContext } from './types'

const Upload = () => {
	const [uploading, setUploading] = useState(false)

	const { details, loading, setDetails, handleOnBoarding } =
		useContext(OnBoardingContext)
	const [uploadFile] = useUploadFile()

	const onDrop = async (acceptedFiles: File[]) => {
		try {
			setUploading(true)
			const [file] = acceptedFiles
			const { url } = await uploadFile({
				extension: file.name.split('.').pop() as AllowedFileExtensions,
				file,
			})
			setDetails({ ...details, profilePicture: url })
		} catch (e) {
			emitToast('Something went wrong. Please try again.', {
				type: 'error',
			})
		} finally {
			setUploading(false)
		}
	}
	const { getRootProps, getInputProps } = useDropzone({ onDrop, maxFiles: 1 })

	return (
		<form className='flex flex-col items-start h-full text-white w-1/4 mt-16'>
			<Heading textStyle='mediumTitle'> Profile Picture</Heading>
			<Text textStyle='caption' className='mt-1 text-dark-title-200 mb-2'>
				Your information will help us in giving you customized designs.
			</Text>
			<div className='mx-auto' {...getRootProps()}>
				<div
					className={cx(
						'bg-dark-300 w-32 h-32 rounded-full flex flex-col justify-center items-center my-4 hover:bg-dark-400 cursor-pointer',
						rippleAnimation
					)}
				>
					<input autoFocus {...getInputProps()} />
					{details.profilePicture || uploading ? (
						<div className='relative'>
							{uploading ? (
								<div className='w-32 h-32 object-cover rounded-full' />
							) : (
								<img
									className='w-32 h-32 object-cover rounded-full'
									src={details.profilePicture}
									alt={details.name}
								/>
							)}
							<div className='absolute top-0 right-0 bg-dark-200 p-2 text-white rounded-full z-10'>
								{uploading ? (
									<FiLoader size={20} className='animate-spin' />
								) : (
									<FiEdit2 size={20} />
								)}
							</div>
						</div>
					) : (
						<div>
							<FiUpload className='mx-auto' size={24} />
							<p className='my-2 mx-auto text-sm'>Upload</p>
						</div>
					)}
				</div>
			</div>
			<Button
				className='max-w-none w-full mt-4'
				size='large'
				disabled={uploading || loading}
				loading={loading}
				onClick={handleOnBoarding}
			>
				Continue
			</Button>
		</form>
	)
}

export default Upload
