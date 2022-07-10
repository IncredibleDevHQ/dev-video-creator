import createRouter from '../createRouter'
import userRouter from './user'
import utilsRouter from './utils'

const appRouter = createRouter()
	.merge('user.', userRouter)
	.merge('util.', utilsRouter)
	.query('healthz', {
		async resolve() {
			return 'Up!'
		},
	})

export type AppRouter = typeof appRouter

export default appRouter
