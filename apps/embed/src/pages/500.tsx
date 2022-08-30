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



const ErrorPage = () => (
	<div className='flex flex-row items-center justify-center h-screen px-2 md:px-0 relative'>
		<div className='flex flex-col'>
			<div className='text-center'>
				<p className='mb-2 text-[150px] font-bold text-white font-main -mt-12'>
					Oops!
				</p>
				<p className='mb-6 text-base font-normal text-dark-title-200 font-body'>
					Sorry, something went wrong
				</p>
			</div>
		</div>
	</div>
)

export default ErrorPage
