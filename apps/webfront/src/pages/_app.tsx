/* eslint-disable react/jsx-props-no-spreading */
import { AppProps } from 'next/app'
import { RecoilRoot } from 'recoil'
import UserProvider from 'src/utils/providers/auth'
import AuthorizedApolloProvider from 'src/utils/providers/authorized-apollo-provider'
import { ToastContainer } from 'ui/src'
import '../styles/globals.css'

const MyApp = ({ Component, pageProps }: AppProps) => (
	<RecoilRoot>
		<UserProvider>
			<ToastContainer limit={2} />
			<AuthorizedApolloProvider>
				<Component {...pageProps} />
			</AuthorizedApolloProvider>
		</UserProvider>
	</RecoilRoot>
)

export default MyApp
