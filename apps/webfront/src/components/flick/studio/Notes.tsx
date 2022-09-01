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

import { css, cx } from '@emotion/css'
import {
	Block,
	CodeBlockProps,
	HeadingBlockProps,
	ImageBlockProps,
	IntroBlockProps,
	ListBlockProps,
	OutroBlockProps,
	VideoBlockProps,
} from 'editor/src/utils/types'
import { useMemo } from 'react'
import { RectReadOnly } from 'react-use-measure'
import { useRecoilValue } from 'recoil'
import { activeObjectIndexAtom } from 'src/stores/studio.store'

export const customScroll = css`
	::-webkit-scrollbar {
		width: 18px;
	}
	::-webkit-scrollbar-track {
		background-color: transparent;
	}
	::-webkit-scrollbar-thumb {
		background-color: #383b40;
		border-radius: 20px;
		border: 6px solid transparent;
		background-clip: content-box;
	}
	::-webkit-scrollbar-thumb:hover {
		background-color: #a8bbbf;
	}
`

const Notes = ({
	dataConfig,
	bounds,
	shortsMode,
}: {
	dataConfig: Block[]
	bounds: RectReadOnly
	shortsMode: boolean
}) => {
	const activeObjectIndex = useRecoilValue(activeObjectIndexAtom)
	const { note } = useMemo(() => {
		const block = dataConfig[activeObjectIndex]
		switch (block?.type) {
			case 'listBlock': {
				const listBlock = dataConfig.find(
					b => b.id === block.id
				) as ListBlockProps
				return {
					note: listBlock.note,
					noteId: listBlock.noteId,
				}
			}
			case 'imageBlock': {
				const imageBlock = dataConfig.find(
					b => b.id === block.id
				) as ImageBlockProps
				return {
					note: imageBlock.note,
					noteId: imageBlock.noteId,
				}
			}
			case 'codeBlock': {
				const codeBlock = dataConfig.find(
					b => b.id === block.id
				) as CodeBlockProps
				return {
					note: codeBlock.note,
					noteId: codeBlock.noteId,
				}
			}
			case 'videoBlock': {
				const videoBlock = dataConfig.find(
					b => b.id === block.id
				) as VideoBlockProps
				return {
					note: videoBlock.note,
					noteId: videoBlock.noteId,
				}
			}
			case 'headingBlock': {
				const headingBlock = dataConfig.find(
					b => b.id === block.id
				) as HeadingBlockProps
				return {
					note: headingBlock.note,
					noteId: headingBlock.noteId,
				}
			}
			case 'introBlock': {
				const introBlock = dataConfig.find(
					b => b.id === block.id
				) as IntroBlockProps
				return {
					note: introBlock.note,
				}
			}
			case 'outroBlock': {
				const outroBlock = dataConfig.find(
					b => b.id === block.id
				) as OutroBlockProps
				return {
					note: outroBlock?.note,
				}
			}
			default:
				return {}
		}
	}, [activeObjectIndex, dataConfig])
	return (
		<div
			className={cx('col-span-2 col-start-11 w-full px-6', {
				'col-start-9': shortsMode,
			})}
		>
			<div
				style={{
					height: `${bounds.height * 0.6}px`,
				}}
				className={cx(
					'h-full mx-auto p-3 bg-zinc-800/90 border border-[#52525B] text-gray-100 text-left text-size-sm font-body rounded-sm outline-none focus:outline-none overflow-y-auto whitespace-pre',
					customScroll
				)}
			>
				{note}
			</div>
		</div>
	)
}
export default Notes
