import * as trpc from '@trpc/server'
import { TRPCError } from '@trpc/server'

import { z } from 'zod'
import type { Context } from '../createContext'
import { Meta } from '../utils/helpers'

const userRouter = trpc
	.router<Context, Meta>()
	/*
		AUTH CHECK MIDDLEWARE

		Note: Certain routes that don't require authentication can be excluded from this middleware
		by passing meta.hasAuth = false.
	*/
	.middleware(({ meta, ctx, next }) => {
		// only check authorization if enabled
		if (meta?.hasAuth && !ctx.user) {
			throw new TRPCError({ code: 'UNAUTHORIZED' })
		}
		return next({
			ctx: {
				...ctx,
				user: ctx.user,
			},
		})
	})
	/*
		QUERIES
	*/
	.query('me', {
		meta: {
			hasAuth: true,
		},
		input: z
			.object({
				text: z.string().nullish(),
			})
			.nullish(),
		output: z.object({
			greeting: z.string(),
			ctx: z.string(),
		}),
		resolve: async ({ input, ctx }) => {
			const out = {
				greeting: `hello ${input?.text ?? ctx.user?.email}`,
				ctx: ctx.user!.sub,
			}

			return out
		},
	})

export default userRouter
