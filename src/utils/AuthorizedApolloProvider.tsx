import {
  ApolloClient,
  ApolloProvider,
  from,
  InMemoryCache,
  split,
} from '@apollo/client'
import { BatchHttpLink } from '@apollo/client/link/batch-http'
import { WebSocketLink } from '@apollo/client/link/ws'
import { setContext } from '@apollo/client/link/context'
import { onError } from '@apollo/client/link/error'
import { getMainDefinition } from '@apollo/client/utilities'
import React from 'react'
import { useAuthState } from 'react-firebase-hooks/auth'
import { useRecoilValue } from 'recoil'
import { emitToast } from '../components'
import config from '../config'
import firebaseState from '../stores/firebase.store'

const AuthorizedApolloProvider = ({
  children,
}: {
  children: React.ReactElement[] | React.ReactElement
}) => {
  const { auth } = useRecoilValue(firebaseState)
  const [user] = useAuthState(auth)

  const httpLink = new BatchHttpLink({
    uri: config.hasura.server as string,
    batchInterval: 20,
  })

  const wsLink = new WebSocketLink({
    uri: config.hasura.wsServer as string,
    options: {
      reconnect: true,
      reconnectionAttempts: 5,
      lazy: true,
      timeout: 5000,
      lazy: true,
      reconnectionAttempts: 3,
    },
  })

  const errorLink = onError(({ graphQLErrors, networkError }) => {
    if (graphQLErrors) {
      const error = graphQLErrors[0]
      emitToast({
        title: "There's something really wrong.",
        type: 'error',
        description: error.message,
      })
    } else if (networkError) {
      emitToast({
        title: 'We lost connection.',
        type: 'error',
        description: networkError.message,
      })
    }
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

  const splitLink = split(
    ({ query }) => {
      const definition = getMainDefinition(query)
      return (
        definition.kind === 'OperationDefinition' &&
        definition.operation === 'subscription'
      )
    },
    wsLink,
    httpLink
  )

  const apolloClient = new ApolloClient({
    link: from([authLink, errorLink, splitLink]),
    cache: new InMemoryCache(),
    connectToDevTools: true,
    defaultOptions: {
      watchQuery: {
        fetchPolicy: 'cache-and-network',
      },
    },
  })

  return <ApolloProvider client={apolloClient}>{children}</ApolloProvider>
}

export default AuthorizedApolloProvider
