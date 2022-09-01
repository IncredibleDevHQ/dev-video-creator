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
		const url = process.env.NEXT_PUBLIC_BASE_URL
			? `${process.env.NEXT_PUBLIC_BASE_URL}/api/trpc`
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
