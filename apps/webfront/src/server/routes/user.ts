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
			throw new TRPCError({
				code: 'UNAUTHORIZED',
				message: 'Invalid Auth Token',
			})
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
	/*
		MUTATIONS
	*/
	.mutation('onboard', {
		meta: {
			hasAuth: true,
		},
		input: z.object({
			designation: z.string().optional(),
			name: z.string(),
			organization: z.string().optional(),
			profilePicture: z.string().optional(),
		}),
		output: z.object({
			success: z.boolean(),
		}),
		resolve: async ({ input, ctx }) => {
			const uptd = await ctx.prisma.user.updateMany({
				where: {
					sub: ctx.user!.sub,
				},
				data: {
					designation: input.designation,
					displayName: input.name,
					organization: input.organization,
					picture: input.profilePicture,
				},
			})
			if (uptd && uptd.count === 1) return { success: true }

			return { success: false }
		},
	})

export default userRouter
