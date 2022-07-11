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
	// remove stack and trace from error as it may contain sensitive data
	.formatError(({ shape, error }) => ({
		...shape,
		data: {
			error: {
				code: error.code,
			},
		},
	}))

export type AppRouter = typeof appRouter

export default appRouter
