import * as trpcNext from '@trpc/server/adapters/next'
import appRouter from 'src/server/routes/route'
import { createContext } from 'src/server/createContext'

// export API handler
export default trpcNext.createNextApiHandler({
	router: appRouter,
	createContext,
	onError({ error }) {
		if (error.code === 'INTERNAL_SERVER_ERROR') {
			// TODO: Add logger
		} else {
			// TODO: Add logger
		}
	},
})
