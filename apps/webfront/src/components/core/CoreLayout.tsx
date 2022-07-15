import Footer from './Footer'
import Header from './Header'

const CoreLayout = ({ children }: any) => (
	<>
		<div className='relative'>
			<Header />
			{children}
		</div>
		<Footer />
	</>
)

export default CoreLayout
