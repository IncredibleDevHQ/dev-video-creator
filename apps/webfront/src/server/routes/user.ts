/* eslint-disable no-underscore-dangle */
import * as trpc from '@trpc/server'
import { TRPCError } from '@trpc/server'

import { z } from 'zod'
import type { Context } from '../createContext'
import { generateSuggestionsFromEmail, Meta } from '../utils/helpers'

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
	.query('availability', {
		meta: {
			hasAuth: true,
		},
		input: z.object({
			username: z.string(),
			senderEmail: z.string(),
		}),
		output: z.object({
			valid: z.boolean(),
			message: z.string(),
			suggestion: z.string().array().optional(),
		}),
		resolve: async ({ input, ctx }) => {
			if (!/^[a-z0-9]+$/.test(input.username)) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message:
						'The username seems invalid. Try a username that is all lowercase.',
					cause: 'Username failed validation.',
				})
			}
			const unameAvailable = await ctx.prisma.user.aggregate({
				_count: true,
				where: {
					username: input.username,
					NOT: {
						email: input.senderEmail,
					},
				},
			})
			if (unameAvailable._count === 0) {
				return {
					valid: true,
					message: 'Username is available',
				}
			}
			return {
				valid: false,
				message: 'Username is not available',
				suggestion: generateSuggestionsFromEmail(input.senderEmail),
			}
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
			updated: z
				.object({
					email: z.string().nullable(),
					displayName: z.string().nullable(),
				})
				.optional(),
		}),
		resolve: async ({ input, ctx }) => {
			const uptd = await ctx.prisma.user.update({
				where: {
					sub: ctx.user!.sub,
				},
				data: {
					designation: input.designation,
					displayName: input.name,
					organization: input.organization,
					picture: input.profilePicture,
				},
				select: {
					displayName: true,
					email: true,
				},
			})
			if (uptd)
				return {
					success: true,
					updated: {
						displayName: uptd.displayName,
						email: uptd.email,
					},
				}

			return { success: false }
		},
	})

export default userRouter
