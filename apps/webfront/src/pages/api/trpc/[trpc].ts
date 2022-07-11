import * as trpcNext from '@trpc/server/adapters/next'
import appRouter from 'src/server/routes/route'
import { createContext } from 'src/server/createContext'

// export API handler
export default trpcNext.createNextApiHandler({
	router: appRouter,
	createContext,
	onError({ error }) {
		// TODO: Add sentry
		console.error(error)
	},
})
