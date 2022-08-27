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



import { cx } from '@emotion/css'
import { useState } from 'react'
import { IoAlbumsOutline, IoDocumentTextOutline } from 'react-icons/io5'
import Container from 'src/components/core/Container'
import FlickTab from 'src/components/dashboard/FlickTab'
import Navbar from 'src/components/dashboard/Navbar'
import SeriesTab from 'src/components/dashboard/SeriesTab'
import requireAuth from 'src/utils/helpers/requireAuth'

const Dashboard = () => {
	const [activeTab, setActiveTab] = useState<'stories' | 'series'>('stories')

	return (
		<Container title='Incredible | Dashboard'>
			<div className='flex flex-col bg-dark-500 h-screen w-screen items-center overflow-hidden'>
				<Navbar />
				<div className='flex items-start flex-1 w-full h-full overflow-hidden'>
					<div className='flex flex-col w-44 py-8 h-full pl-6 gap-y-2'>
						<button
							type='button'
							onClick={() => setActiveTab('stories')}
							className={cx(
								'flex items-center gap-x-2 w-full py-1.5 text-left px-4 border-l-2 hover:text-gray-100 text-size-sm',
								{
									'border-green-600 text-gray-100': activeTab === 'stories',
									'border-transparent text-gray-400': activeTab !== 'stories',
								}
							)}
						>
							<IoDocumentTextOutline />
							<span className='text-sm'>Stories</span>
						</button>
						<button
							type='button'
							onClick={() => setActiveTab('series')}
							className={cx(
								'flex items-center gap-x-2 w-full py-1.5 text-left px-4 border-l-2 hover:text-gray-100 text-size-sm',
								{
									'border-green-600 text-gray-100': activeTab === 'series',
									'border-transparent text-gray-400': activeTab !== 'series',
								}
							)}
						>
							<IoAlbumsOutline />
							<span className='text-sm'>Series</span>
						</button>
					</div>
					{activeTab === 'stories' && <FlickTab />}
					{activeTab === 'series' && <SeriesTab />}
				</div>
			</div>
		</Container>
	)
}

export const getServerSideProps = requireAuth()(async () => ({
	props: {},
}))

export default Dashboard
