import {
  ApolloClient,
  ApolloProvider,
  from,
  InMemoryCache,
} from '@apollo/client'
import { setContext } from '@apollo/client/link/context'
import { BatchHttpLink } from '@apollo/client/link/batch-http'
import { onError } from '@apollo/client/link/error'
import React from 'react'
import { useRecoilValue } from 'recoil'
import config from '../config'
import { useCrash } from '../hooks'
import { authState } from '../stores/auth.store'
import { emitToast } from '../components'
import firebaseState from '../stores/firebase.store'

const AuthorizedApolloProvider = ({
  children,
}: {
  children: React.ReactElement[] | React.ReactElement
}) => {
  const crash = useCrash()

  const { auth } = useRecoilValue(firebaseState)

  const httpLink = new BatchHttpLink({
    uri: config.hasura.server as string,
    batchInterval: 20,
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
      console.log(networkError)
      emitToast({
        title: 'We lost connection.',
        type: 'error',
        description: networkError.message,
      })
    }
  })

  const authLink = setContext(async (_, { headers }) => {
    const newHeaders = auth.currentUser
      ? {
          ...headers,
          Authorization: `Bearer ${await auth.currentUser?.getIdToken()}`,
        }
      : { ...headers, 'X-Hasura-Role': 'anonymous' }
    return {
      headers: newHeaders,
    }
  })

  const apolloClient = new ApolloClient({
    link: from([authLink, errorLink, httpLink]),
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
