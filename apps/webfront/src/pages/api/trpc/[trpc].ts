import * as trpcNext from '@trpc/server/adapters/next'
import appRouter from 'server/routes/route'
import { createContext } from 'server/createContext'

// export API handler
export default trpcNext.createNextApiHandler({
	router: appRouter,
	createContext,
	onError({ error }) {
		// TODO: Add sentry
		console.error(error)
	},
})
