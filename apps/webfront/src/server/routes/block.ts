import { TRPCError } from '@trpc/server'
import * as trpc from '@trpc/server'
import { z } from 'zod'

import { Context } from '../createContext'
import { Meta } from '../utils/helpers'

const blockRouter = trpc
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
	// ACTIONS
	.mutation('save', {
		meta: {
			hasAuth: true,
		},
		input: z.object({
			blockId: z.string(),
			recordingId: z.string(),
			fragmentId: z.string(),
			flickId: z.string(),
			objectUrl: z.string(),
			creationMeta: z.any().optional(),
			playbackDuration: z.number().optional(),
			thumbnail: z.string().optional(),
		}),
		resolve: async ({ ctx, input }) => {
			// TODO: verify this is working as expected wrt on_conflict update
			const saveBlock = await ctx.prisma.blocks.upsert({
				where: {
					id_recordingId: {
						id: input.blockId,
						recordingId: input.recordingId,
					},
				},
				create: {
					id: input.blockId,
					recordingId: input.recordingId,
					fragmentId: input.fragmentId,
					flickId: input.flickId,
					objectUrl: input.objectUrl,
					creationMeta: input.creationMeta || undefined,
					playbackDuration: input.playbackDuration || undefined,
					thumbnail: input.thumbnail || undefined,
				},
				update: {
					updatedAt: new Date(),
					creationMeta: input.creationMeta,
					objectUrl: input.objectUrl,
					playbackDuration: input.playbackDuration,
					thumbnail: input.thumbnail,
				},
				select: {
					id: true,
					updatedAt: true,
				},
			})
			if (!saveBlock.id) {
				throw new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: 'Failed to save block.Try again!',
				})
			}
			return {
				id: saveBlock.id,
				success: true,
			}
		},
	})

export default blockRouter
