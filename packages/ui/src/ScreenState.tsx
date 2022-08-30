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



import { Loader } from './Loader'

export const ScreenState = ({
	title,
	subtitle,
	button,
	onHandleClick,
	loading = true,
}: {
	title?: string
	subtitle?: string
	button?: string
	onHandleClick?: () => void
	loading?: boolean
}) => (
	<div className='fixed left-0 top-0 z-10 flex min-h-screen w-screen flex-col items-center justify-center bg-dark-500 p-4'>
		{loading && <Loader className='w-14 h-14' />}

		<div style={{ maxWidth: 256 }}>
			{title && (
				<h2 className='text-xl mt-8 mb-2 text-center font-bold text-gray-100'>
					{title}
				</h2>
			)}
			{subtitle && (
				<h4 className='text-sm text-center text-gray-200'>{subtitle}</h4>
			)}
		</div>
		{button && (
			<button type='button' className='mt-12' onClick={onHandleClick}>
				{button}
			</button>
		)}
	</div>
)

ScreenState.defaultProps = {
	title: undefined,
	subtitle: undefined,
	button: undefined,
	onHandleClick: undefined,
	loading: true,
}
