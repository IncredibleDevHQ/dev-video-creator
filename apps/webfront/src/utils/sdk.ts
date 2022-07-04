import { GraphQLClient } from 'graphql-request'
import { getSdk } from '../graphql/generated-ssr'

const client = new GraphQLClient(process.env.NEXT_PUBLIC_HASURA_SERVER, {
	headers: {
		'x-hasura-admin-secret': process.env.HASURA_ADMIN_SECRET,
	},
})

const sdk = getSdk(client)

export default sdk
