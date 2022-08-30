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



import { FiEdit, FiRepeat, FiTrash } from 'react-icons/fi'

const VideoTooltip = ({
	editVideo,
	retakeVideo,
	deleteVideo,
	node,
	updateAttributes,
}: {
	deleteVideo: () => void
	editVideo: (val: boolean) => void
	retakeVideo: (val: boolean) => void
	node: any
	updateAttributes: any
}) => (
	<div className='hidden group-hover:flex items-center gap-x-1 pl-2 text-gray-300 bg-gray-800 rounded-sm m-2 absolute z-50 shadow-md cursor-default font-body'>
		<FiEdit
			size={16}
			className='mx-1 cursor-pointer hover:text-gray-50'
			onClick={() => editVideo(true)}
		/>
		<FiRepeat
			size={16}
			className='mx-1 cursor-pointer hover:text-gray-50'
			onClick={() => retakeVideo(true)}
		/>
		<FiTrash
			size={16}
			className='mx-1 cursor-pointer hover:text-gray-50'
			onClick={deleteVideo}
		/>
		<button
			className='hidden group-hover:block hover:bg-gray-700 text-white px-2  border-gray-300 pl-2 rounded-r-sm py-1'
			type='button'
			onClick={() => {
				if (node.attrs.caption === null)
					updateAttributes({
						caption: '',
					})
				else
					updateAttributes({
						caption: null,
					})
			}}
		>
			{node.attrs.caption === null ? 'Add caption' : 'Remove Caption'}
		</button>
	</div>
)

export default VideoTooltip
