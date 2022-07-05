import * as trpc from '@trpc/server'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import type { Context } from '../createContext'

const userRouter = trpc
	.router()
	.middleware(async ({ ctx, next }) => {
		const context = await (ctx as Context)
		if (!context.user) {
			throw new TRPCError({ code: 'UNAUTHORIZED' })
		}
		return next()
	})
	.query('me', {
		input: z
			.object({
				text: z.string().nullish(),
			})
			.nullish(),
		resolve: async ({ input, ctx }) => {
			const context = await (ctx as Context)
			const out = {
				greeting: `hello ${input?.text ?? context.user?.email}`,
				ctx: context.user,
			}

			return out
		},
	})

export default userRouter
