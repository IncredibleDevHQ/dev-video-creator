import createRouter from '../createRouter'
import userRouter from './user'
import utilsRouter from './utils'
import storyRouter from './story'

const appRouter = createRouter()
	.merge('user.', userRouter)
	.merge('util.', utilsRouter)
	.merge('story.', storyRouter)
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
