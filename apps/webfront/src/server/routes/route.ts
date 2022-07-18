import createRouter from '../createRouter'
import userRouter from './user'
import utilsRouter from './utils'
import storyRouter from './story'
import collaborateRouter from './collaborate'
import fragmentRouter from './fragment'
import recordingRouter from './record'
import blockRouter from './block'

const appRouter = createRouter()
	.merge('user.', userRouter)
	.merge('story.', storyRouter)
	.merge('collab.', collaborateRouter)
	.merge('fragment.', fragmentRouter)
	.merge('recording.', recordingRouter)
	.merge('block.', blockRouter)
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
