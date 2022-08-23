// Copyright (c) 2022 Pixelbyte Studio Pvt Ltd
//
// This file is part of Incredible, Pixelbyte Studio Pvt Ltd
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program\.  If not, see <http://www\.gnu\.org/licenses/>\.

/* eslint-disable @next/next/no-img-element */
/* eslint-disable jsx-a11y/no-autofocus */
/* eslint-disable react/jsx-props-no-spreading */
import { cx } from '@emotion/css'
import React, { useContext, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { FiEdit2, FiLoader, FiUpload } from 'react-icons/fi'
import { useRecoilValue } from 'recoil'
import { activeFragmentIdAtom, flickAtom } from 'src/stores/flick.store'
import { emitToast, Heading, Button, Text } from 'ui/src'
import { useUploadFile, AllowedFileExtensions } from 'utils/src'
import { UploadType } from 'utils/src/enums'
import { rippleAnimation } from './People'
import { OnBoardingContext } from './types'

const Upload = (props: { uploadTag: UploadType }) => {
	const { uploadTag } = props

	const [uploading, setUploading] = useState(false)

	const { details, loading, setDetails, handleOnBoarding } =
		useContext(OnBoardingContext)
	const [uploadFile] = useUploadFile()

	const flick = useRecoilValue(flickAtom)
	const fragmentId = useRecoilValue(activeFragmentIdAtom)

	const onDrop = async (acceptedFiles: File[]) => {
		try {
			setUploading(true)
			const [file] = acceptedFiles
			const { url } = await uploadFile({
				extension: file.name.split('.').pop() as AllowedFileExtensions,
				file,
				tag: uploadTag,
				meta: {
					flickId: flick?.id,
					fragmentId: fragmentId ?? undefined,
				},
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
		<form className='flex flex-col items-start h-full text-white w-full px-4 md:w-[450px] mt-16'>
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
