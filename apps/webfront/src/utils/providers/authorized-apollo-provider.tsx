import {
	ApolloClient,
	ApolloProvider,
	from,
	InMemoryCache,
	split,
} from '@apollo/client'
import { BatchHttpLink } from '@apollo/client/link/batch-http'
import { setContext } from '@apollo/client/link/context'
import { WebSocketLink } from '@apollo/client/link/ws'
import React from 'react'

import { getMainDefinition } from '@apollo/client/utilities'
import { useUser } from './auth'

const AuthorizedApolloProvider = ({
	children,
}: {
	children: React.ReactElement[] | React.ReactElement
}) => {
	const { user } = useUser()

	const httpLink = new BatchHttpLink({
		uri: process.env.NEXT_PUBLIC_HASURA_SERVER,
		batchInterval: 20,
	})

	const authLink = setContext(async (_, { headers }) => {
		const newHeaders = user
			? {
					...headers,
					Authorization: `Bearer ${await user.getIdToken()}`,
			  }
			: { ...headers, 'X-Hasura-Role': 'anonymous' }
		return {
			headers: newHeaders,
		}
	})

	const wsLink =
		typeof window === 'undefined'
			? null
			: new WebSocketLink({
					uri: process.env.NEXT_PUBLIC_HASURA_WS_SERVER,
					options: {
						reconnect: true,
						lazy: true,
						connectionParams: async () => ({
							headers: {
								Authorization: `Bearer ${await user?.getIdToken()}`,
							},
						}),
					},
			  })

	const splitLink =
		typeof window === 'undefined'
			? httpLink
			: split(
					({ query }) => {
						const definition = getMainDefinition(query)
						return (
							definition.kind === 'OperationDefinition' &&
							definition.operation === 'subscription'
						)
					},
					wsLink!,
					httpLink
			  )

	const apolloClient = new ApolloClient({
		link: from([authLink, splitLink]),
		cache: new InMemoryCache(),
		connectToDevTools: true,
		defaultOptions: {
			watchQuery: {
				fetchPolicy: 'network-only',
			},
		},
	})

	return <ApolloProvider client={apolloClient}>{children}</ApolloProvider>
}

export default AuthorizedApolloProvider
