import { router } from '@trpc/server'
import superjson from 'superjson'
import { Context } from './createContext'

function createRouter() {
	return router<Context>().transformer(superjson)
}

export default createRouter
