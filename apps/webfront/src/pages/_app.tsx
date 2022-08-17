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
