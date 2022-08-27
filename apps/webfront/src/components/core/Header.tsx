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



import NextLink from 'next/link'
import { FaGithub } from 'react-icons/fa'
import Logo from 'svg/Logo.svg'
import { Button } from 'ui/src'

const Header = () => (
	<header className='flex justify-between sm:px-8 sm:py-6 p-6 relative md:absolute top-0 left-0 right-0 z-50'>
		<NextLink href='/'>
			<Logo />
		</NextLink>

		<a href='https://github.com/IncredibleDevHQ/Incredible'>
			<Button
				size='large'
				className='text-size-md'
				colorScheme='dark'
				appearance='solid'
				leftIcon={<FaGithub size={21} />}
			>
				Star Us
			</Button>
		</a>
	</header>
)

export default Header
