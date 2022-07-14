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
		input: z.object({
			sub: z.string(),
		}),
		output: z.object({
			onboarded: z.boolean(),
			sub: z.string(),
			username: z.string(),
			displayName: z.string().nullable(),
			email: z.string().nullable(),
			provider: z.string().nullable().optional().nullable(),
			picture: z.string().nullable(),
			updatedAt: z.date().nullable(),
			createdAt: z.date(),
		}),
		resolve: async ({ input, ctx }) => {
			const me = await ctx.prisma.user.findUnique({
				where: {
					sub: input.sub,
				},
				select: {
					onboarded: true,
					sub: true,
					username: true,
					displayName: true,
					email: true,
					provider: true,
					picture: true,
					updatedAt: true,
					createdAt: true,
				},
			})
			if (!me) {
				throw new TRPCError({
					code: 'NOT_FOUND',
					message: 'User not found',
				})
			}
			return me
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
					onboarded: true,
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
