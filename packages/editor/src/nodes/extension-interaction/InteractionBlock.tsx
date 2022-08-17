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

/* eslint-disable react/prop-types */
import { Popover } from '@headlessui/react'
import { NodeViewWrapper } from '@tiptap/react'
import React, { useState } from 'react'
import { IoInformationCircleOutline } from 'react-icons/io5'
import { Button, Heading } from 'ui/src'
import CommandCodeSandbox from '../../assets/Command_CodeSandbox.svg'
import CommandReplit from '../../assets/Command_Replit.svg'
import CommandStackBlitz from '../../assets/Command_Stackblitz.svg'

export interface IframeOptions {
	allowFullscreen: boolean
	HTMLAttributes: {
		[key: string]: any
	}
}

const getTypeSpecifics = (
	type: string
): {
	name: string
	icon: React.ReactNode
	placeholder: string
} => {
	switch (type) {
		case 'stackblitz':
			return {
				name: 'StackBlitz',
				icon: <CommandStackBlitz />,
				placeholder: 'https://stackblitz.com/edit/',
			}
		case 'codesandbox':
			return {
				name: 'CodeSandbox',
				icon: <CommandCodeSandbox />,
				placeholder: 'https://codesandbox.io/s/',
			}
		case 'replit':
			return {
				name: 'Replit',
				icon: <CommandReplit />,
				placeholder: 'https://repl.it/',
			}
		default:
			return {
				name: 'CodeSandbox',
				icon: <CommandCodeSandbox className='w-full h-5' />,
				placeholder: 'https://codesandbox.io/s/',
			}
	}
}

const UrlInput = ({ props }: { props: any }) => {
	const [url, setUrl] = useState<string>()

	return (
		<div
			style={{
				width: '450px',
			}}
			className='flex flex-col gap-y-4 bg-white border shadow-sm pb-4 px-5 rounded-sm -mt-3'
		>
			<div className='flex items-center justify-between'>
				<Heading textStyle='smallTitle' className='font-bold'>
					Enter {getTypeSpecifics(props?.node?.attrs?.type).name} URL
				</Heading>
				<Button
					size='small'
					type='button'
					disabled={!url}
					onClick={() => {
						props.updateAttributes({
							src: url,
						})
					}}
				>
					Embed
				</Button>
			</div>
			<input
				className='bg-gray-100 border border-transparent py-2 px-2 rounded-sm w-full h-full focus:border-brand focus:outline-none font-body text-sm placeholder-gray-400 text-black'
				value={url}
				onChange={e => setUrl(e.target.value)}
				placeholder={getTypeSpecifics(props?.node?.attrs?.type).placeholder}
			/>
		</div>
	)
}

export const InteractionBlock = (props: any) => {
	const { node } = props
	const { src, type } = node.attrs

	const [isInputOpen, setInputOpen] = useState(false)

	return (
		<NodeViewWrapper className='my-3' id={node.attrs.id}>
			{src ? (
				<>
					<div className='flex items-center font-body text-size-xs gap-x-2 mb-1 text-gray-500'>
						<IoInformationCircleOutline />
						Interactions are not part of your recording. It will be available in
						the video player for viewers
					</div>
					<iframe
						src={src}
						style={{
							width: '100%',
							height: '450px',
							border: '0',
							borderRadius: '4px',
						}}
						title='Interaction'
						allow='accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr-spatial-tracking;'
						sandbox='allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts'
					/>
				</>
			) : (
				<Popover className='relative'>
					<Popover.Button
						as='button'
						className='w-full bg-gray-100 rounded-sm flex items-center px-4 py-3 gap-x-2 text-gray-400 hover:bg-gray-200 cursor-pointer hover:text-gray-500 active:bg-gray-300 transition-all'
						onClick={() => setInputOpen(!isInputOpen)}
					>
						<div className='filter grayscale brightness-75'>
							{getTypeSpecifics(type).icon}
						</div>
						<span spellCheck={false} className='font-body'>
							Add {getTypeSpecifics(type).name}
						</span>
					</Popover.Button>
					{isInputOpen && (
						<Popover.Panel className='absolute z-10' as='div' static>
							<UrlInput props={props} />
						</Popover.Panel>
					)}
				</Popover>
			)}
		</NodeViewWrapper>
	)
}
