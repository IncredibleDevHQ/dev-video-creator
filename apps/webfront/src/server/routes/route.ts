import createRouter from '../createRouter'
import userRouter from './userRouter'

const appRouter = createRouter().merge('users.', userRouter)

export type AppRouter = typeof appRouter

export default appRouter
