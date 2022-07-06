/* eslint-disable react/jsx-props-no-spreading */
import { css, cx } from '@emotion/css'
import { Popover } from '@headlessui/react'
import { Editor } from '@tiptap/core'
import { NodeViewWrapper } from '@tiptap/react'
import { NodeSelection } from 'prosemirror-state'
import React, { useState } from 'react'
import { buildStyles, CircularProgressbar } from 'react-circular-progressbar'
import Dropzone from 'react-dropzone'
import { FaUnsplash } from 'react-icons/fa'
import { IoCloudUploadOutline, IoImageOutline } from 'react-icons/io5'
import { SiGiphy } from 'react-icons/si'
import { emitToast, Text } from 'ui/src'
import { AllowedFileExtensions, useEnv, useUploadFile } from 'utils/src'
import AppLogo from '../../assets/Logo.svg'
import { GiphyTab } from './GiphyTab'
import { IncredibleGifs } from './IncredibleGifs'
import { UnsplashTab } from './UnsplashTab'

const tabs = [
	{
		id: 'Upload',
		name: 'Upload',
	},
	{
		id: 'IncredibleGIFS',
		name: 'Incredible GIFS',
		icon: AppLogo,
	},
	{
		id: 'GIPHY',
		name: 'GIPHY',
		icon: SiGiphy,
	},
	{
		id: 'Unsplash',
		name: 'Unsplash',
		icon: FaUnsplash,
	},
]

const ImageInput = ({
	uploadMedia,
	updateAttributes,
	setLocalSrc,
}: {
	uploadMedia: (files: File[]) => Promise<void>
	updateAttributes: any
	setLocalSrc: React.Dispatch<React.SetStateAction<string | undefined>>
}) => {
	const [activeTabId, setActiveTabId] = useState(tabs[0].id)

	return (
		<div className='bg-white border shadow-sm py-4 px-5 rounded-sm -mt-3 w-[525px]'>
			<div className='flex gap-x-6 mb-4'>
				{tabs.map(tab => (
					<button
						type='button'
						onClick={() => setActiveTabId(tab.id)}
						className={cx(
							'text-sm text-gray-400 flex items-center gap-x-1.5 cursor-pointer transition-all font-bold',
							{
								'text-gray-800': tab.id === activeTabId,
							}
						)}
					>
						{tab.icon && (
							<tab.icon
								className={cx('w-3 h-3 filter grayscale', {
									'brightness-0': tab.id === activeTabId,
								})}
							/>
						)}
						{tab.name}
					</button>
				))}
			</div>
			{activeTabId === tabs[0].id && (
				<Dropzone onDrop={uploadMedia} accept={{ 'image/*': [] }} maxFiles={1}>
					{({ getRootProps, getInputProps }) => (
						<div
							tabIndex={-1}
							onKeyUp={() => {}}
							role='button'
							className='flex flex-col items-center p-4 border border-gray-200 border-dashed rounded-md cursor-pointer'
							{...getRootProps()}
						>
							<input {...getInputProps()} />
							<IoCloudUploadOutline size={21} className='mb-2 text-gray-600' />

							<div className='z-50 text-center text-gray-600 flex flex-col justify-center text-xs gap-y-1'>
								<span className='font-body'>Drag and drop or</span>
								<span className='font-semibold text-gray-800'>browse</span>
							</div>
						</div>
					)}
				</Dropzone>
			)}
			{activeTabId === tabs[1].id && (
				<IncredibleGifs
					updateAttributes={updateAttributes}
					setLocalSrc={setLocalSrc}
				/>
			)}
			{activeTabId === tabs[2].id && (
				<GiphyTab
					updateAttributes={updateAttributes}
					setLocalSrc={setLocalSrc}
				/>
			)}
			{activeTabId === tabs[3].id && (
				<UnsplashTab
					updateAttributes={updateAttributes}
					setLocalSrc={setLocalSrc}
				/>
			)}
		</div>
	)
}

export const Image = (props: any) => {
	const { node, updateAttributes, getPos, editor } = props
	const { src, alt, title, caption } = node.attrs

	const { storage } = useEnv()

	const [localSrc, setLocalSrc] = useState<string>()

	const [isInputOpen, setInputOpen] = useState(false)

	const [upload] = useUploadFile()
	const [loading, setLoading] = useState(false)
	const [progress, setProgress] = useState(0)

	const setMedia = (file: File) => {
		const reader = new FileReader()
		reader.readAsDataURL(file)
		reader.onload = readerEvent => {
			setLocalSrc(readerEvent.target?.result as string)
		}
	}

	const uploadMedia = async (files: File[]) => {
		try {
			setLoading(true)
			const file = files?.[0]
			if (!file) throw new Error('No file selected')
			setMedia(file)
			const { uuid } = await upload({
				file,
				extension: file.name.split('.').pop() as AllowedFileExtensions,
				handleProgress: ({ percentage }) => {
					setProgress(percentage)
				},
			})
			updateAttributes({
				src: `${storage.cdn}${uuid}`,
			})
			setLoading(false)
			setProgress(0)
		} catch (error: any) {
			setLoading(false)
			setProgress(0)
			emitToast(`Failed to upload thumbnail ${error.message}`, {
				type: 'error',
			})
		}
	}

	return (
		<NodeViewWrapper as='div' id={node.attrs.id}>
			{src && (
				<div contentEditable={false} className='group relative my-4'>
					<button
						className='hidden group-hover:block absolute top-0 left-0 bg-gray-800 hover:bg-gray-700 text-white px-2.5 py-1 rounded-sm z-50 m-2 font-body'
						type='button'
						onClick={() => {
							if (caption === null)
								updateAttributes({
									caption: '',
								})
							else
								updateAttributes({
									caption: null,
								})
						}}
					>
						{caption === null ? 'Add caption' : 'Remove Caption'}
					</button>
					<img
						className='cursor-pointer w-full group-hover:bg-gray-100 border border-transparent group-hover:border-gray-200 rounded-sm'
						src={localSrc || src}
						alt={alt}
						title={title}
					/>
					{caption !== null && (
						<input
							onFocus={() => {
								const coreEditor = editor as Editor
								coreEditor.view.dispatch(
									coreEditor.view.state.tr.setSelection(
										NodeSelection.create(coreEditor.view.state.doc, getPos())
									)
								)
							}}
							value={caption}
							placeholder='Write a caption...'
							className='border border-gray-200 w-full group-hover:bg-gray-100 font-body px-2 py-1 focus:outline-none placeholder-italic text-black mt-px'
							onChange={e => {
								updateAttributes({ caption: e.target.value })
							}}
						/>
					)}
				</div>
			)}

			{loading && (
				<div className='relative'>
					{localSrc && <img src={localSrc} alt='img' />}
					<div className='absolute bottom-4 right-4 flex items-center justify-between px-1.5 rounded-sm gap-x-2 bg-black bg-opacity-60 w-20'>
						<div className='w-4 h-4'>
							<CircularProgressbar
								styles={buildStyles({
									rotation: 0.25,
									strokeLinecap: 'round',
									textSize: '12px',
									pathColor: `rgba(22, 163, 74, ${progress / 100})`,
									textColor: '#f88',
									trailColor: '#fafafa',
								})}
								value={progress}
							/>
						</div>
						<Text
							className={cx(
								css`
									color: #fefefe !important;
									font-size: 0.875rem !important;
									line-height: 1.25rem !important;
									margin: 3px !important;
								`
							)}
							contentEditable={false}
						>
							{progress}%
						</Text>
					</div>
				</div>
			)}

			{!src && !loading && (
				<Popover className='relative'>
					<Popover.Button
						as='button'
						className='w-full bg-gray-100 rounded-sm flex items-center px-4 py-3 gap-x-2 text-gray-400 hover:bg-gray-200 cursor-pointer hover:text-gray-500 active:bg-gray-300 transition-all'
						onClick={() => setInputOpen(!isInputOpen)}
					>
						<IoImageOutline />
						<span className='font-body'>Add image</span>
					</Popover.Button>
					{isInputOpen && (
						<Popover.Panel className='absolute z-10' as='div' static>
							<ImageInput
								uploadMedia={uploadMedia}
								updateAttributes={updateAttributes}
								setLocalSrc={setLocalSrc}
							/>
						</Popover.Panel>
					)}
				</Popover>
			)}
		</NodeViewWrapper>
	)
}
