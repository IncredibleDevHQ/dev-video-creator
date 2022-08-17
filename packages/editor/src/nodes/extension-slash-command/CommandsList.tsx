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

import { css, cx } from '@emotion/css'
import React from 'react'
import { Text } from 'ui/src'
import CommandCode from '../../assets/Command_Code.svg'
import CommandCodeSandbox from '../../assets/Command_CodeSandbox.svg'
import CommandHeading1 from '../../assets/Command_Heading1.svg'
import CommandHeading2 from '../../assets/Command_Heading2.svg'
import CommandHeading3 from '../../assets/Command_Heading3.svg'
import CommandImage from '../../assets/Command_Image.svg'
import CommandList from '../../assets/Command_List.svg'
import CommandReplit from '../../assets/Command_Replit.svg'
import CommandScreenGrab from '../../assets/Command_ScreenGrab.svg'
import CommandStackBlitz from '../../assets/Command_Stackblitz.svg'
import CommandText from '../../assets/Command_Text.svg'
import CommandVideo from '../../assets/Command_Video.svg'
import { SuggestionItem } from './items'

export type CommandsListState = {
	selectedIndex: number
}

export class CommandsList extends React.Component<any, CommandsListState> {
	static isInViewport(ele: HTMLElement, container: HTMLElement) {
		const eleTop = ele.offsetTop
		const eleBottom = eleTop + ele.clientHeight

		const containerTop = container.scrollTop
		const containerBottom = containerTop + container.clientHeight

		// The element is fully visible in the container
		return eleTop >= containerTop && eleBottom <= containerBottom
	}

	constructor(props: any) {
		super(props)
		this.state = {
			selectedIndex: 0,
		}
	}

	// being used by parent
	// eslint-disable-next-line react/no-unused-class-component-methods
	onKeyDown({ event }: { event: KeyboardEvent }) {
		if (event.key === 'ArrowUp') {
			this.upHandler()
			return true
		}

		if (event.key === 'ArrowDown') {
			this.downHandler()
			return true
		}

		if (event.key === 'Enter') {
			this.enterHandler()
			return true
		}

		return false
	}

	getIcon = (item: SuggestionItem) => {
		if (item.title === 'H1') return <CommandHeading1 />
		if (item.title === 'H2') return <CommandHeading2 />
		if (item.title === 'H3') return <CommandHeading3 />
		if (item.title === 'Text') return <CommandText />
		if (item.title === 'Code') return <CommandCode />
		if (item.title === 'Image') return <CommandImage />
		if (item.title === 'Video') return <CommandVideo />
		if (item.title === 'List') return <CommandList />
		if (item.title === 'Screengrab') return <CommandScreenGrab />
		if (item.title === 'CodeSandbox') return <CommandCodeSandbox />
		if (item.title === 'StackBlitz') return <CommandStackBlitz />
		if (item.title === 'Replit') return <CommandReplit />
		return null
	}

	upHandler() {
		const { items } = this.props
		this.setState(prev => {
			const newIndex = (prev.selectedIndex + items.length - 1) % items.length
			const commandListing = document.getElementById(
				`editor-command-${items[newIndex].title}`
			)
			const commandList = document.getElementById('editor-commands-viewport')
			if (
				commandList &&
				commandListing &&
				!CommandsList.isInViewport(commandListing, commandList)
			) {
				commandListing.scrollIntoView()
			}
			return {
				selectedIndex: newIndex,
			}
		})
	}

	downHandler() {
		const { items } = this.props

		this.setState(prev => {
			const newIndex = (prev.selectedIndex + 1) % items.length
			const commandListing = document.getElementById(
				`editor-command-${items[newIndex].title}`
			)
			const commandList = document.getElementById('editor-commands-viewport')
			if (
				commandList &&
				commandListing &&
				!CommandsList.isInViewport(commandListing, commandList)
			) {
				commandListing.scrollIntoView()
			}
			return {
				selectedIndex: newIndex,
			}
		})
	}

	enterHandler() {
		const { selectedIndex } = this.state
		this.selectItem(selectedIndex)
	}

	selectItem(index: number) {
		const { items, command } = this.props
		const item = items[index]

		if (item) {
			command(item)
		}
	}

	render() {
		const { props } = this
		const items = props.items as SuggestionItem[]
		const { selectedIndex } = this.state

		return items.length > 0 ? (
			<div
				id='editor-commands-viewport'
				className={cx(
					'flex flex-col overflow-y-scroll bg-white border border-cool-gray-300 rounded-sm shadow-md h-80 w-[336px]',
					css`
						::-webkit-scrollbar {
							display: none;
						}
					`
				)}
			>
				{items.map((item, index) => (
					<div
						id={`editor-command-${item.title}`}
						key={item.title}
						className='flex flex-col px-3'
					>
						{item.type !== items[index - 1]?.type && (
							<Text
								textStyle='caption'
								className='text-gray-600 font-body pt-3 pb-1.5'
							>
								{item.type.toUpperCase()}
							</Text>
						)}
						<button
							type='button'
							className={cx(
								'px-3 py-1.5 flex items-center justify-between rounded-sm hover:bg-gray-100 focus:outline-none',
								{
									'bg-gray-100': index === selectedIndex,
									'mb-4': index === items.length - 1,
								}
							)}
							key={item.title}
							onClick={() => this.selectItem(index)}
						>
							<div className='flex items-center mr-20 gap-x-3'>
								<div className='flex items-center justify-center h-10 w-10 bg-gray-800 rounded-sm'>
									{this.getIcon(item)}
								</div>
								<div className='flex flex-col items-start gap-y-px'>
									<Text
										textStyle='standardLink'
										className='font-bold text-gray-800'
									>
										{item.title}
									</Text>
									<Text textStyle='caption' className='text-gray-600'>
										{item.description}
									</Text>
								</div>
							</div>
							{item.shortcut && (
								<Text
									textStyle='caption'
									className='p-1 text-red-800 bg-gray-100 border border-gray-300 rounded-sm'
								>
									{item.shortcut}
								</Text>
							)}
						</button>
					</div>
				))}
			</div>
		) : null
	}
}

export default CommandsList
