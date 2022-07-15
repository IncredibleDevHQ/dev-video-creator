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
