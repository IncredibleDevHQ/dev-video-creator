/* eslint-disable react/jsx-props-no-spreading */
import { withTRPC } from '@trpc/next'
import { AppProps } from 'next/app'
import NextNProgress from 'nextjs-progressbar'
import { RecoilRoot } from 'recoil'
import { AppRouter } from 'server/routes/route'
import UserProvider from 'src/utils/providers/auth'
import superjson from 'superjson'
import { ToastContainer } from 'ui/src'
import '../styles/globals.css'

const MyApp = ({ Component, pageProps }: AppProps) => (
	<RecoilRoot>
		<UserProvider>
			<NextNProgress color='#15803D' height={3} />
			<ToastContainer limit={2} />
			<Component {...pageProps} />
		</UserProvider>
	</RecoilRoot>
)

export default withTRPC<AppRouter>({
	config() {
		/**
		 * If you want to use SSR, you need to use the server's full URL
		 * @link https://trpc.io/docs/ssr
		 */
		const url = process.env.VERCEL_URL
			? `https://${process.env.VERCEL_URL}/api/trpc`
			: 'http://localhost:3000/api/trpc'

		return {
			url,
			transformer: superjson,
			// eslint-disable-next-line consistent-return
			headers: () => ({
				Authorization:
					typeof window !== 'undefined'
						? `Bearer ${localStorage?.getItem('token')}`
						: '',
			}),
			/**
			 * @link https://react-query.tanstack.com/reference/QueryClient
			 */
			// queryClientConfig: { defaultOptions: { queries: { staleTime: 60 } } },
		}
	},
	/**
	 * @link https://trpc.io/docs/ssr
	 */
	ssr: false, // NOTE: SSR enabled may cause certain problems like this https://github.com/trpc/trpc/issues/596
})(MyApp)
