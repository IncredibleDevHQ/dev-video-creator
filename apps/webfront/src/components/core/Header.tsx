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

import NextLink from 'next/link'
import Logo from 'svg/Logo.svg'

const Header = () => (
	<header className='flex justify-between sm:px-8 sm:py-6 p-6 relative md:absolute top-0 left-0 right-0 z-50'>
		<NextLink href='/'>
			<Logo />
		</NextLink>
	</header>
)

export default Header
