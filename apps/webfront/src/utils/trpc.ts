import { createReactQueryHooks } from '@trpc/react'
import type { AppRouter } from 'src/server/routes/route'

const trpc = createReactQueryHooks<AppRouter>()

export default trpc
