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
	.mutation('saveMany', {
		meta: {
			hasAuth: true,
		},
		input: z.object({
			blocks: z.array(
				z.object({
					id: z.string(),
					playbackDuration: z.number(),
					thumbnail: z.string().nullish(),
				})
			),
			flickId: z.string(),
			fragmentId: z.string(),
			recordingId: z.string(),
			url: z.string(),
		}),
		resolve: async ({ ctx, input }) => {
			const blocks = input.blocks.map(block => ({
				id: block.id,
				flickId: input.flickId,
				fragmentId: input.fragmentId,
				recordingId: input.recordingId,
				objectUrl: input.url,
				playbackDuration: block.playbackDuration,
				thumbnail: block.thumbnail,
			}))

			await ctx.prisma.$transaction([
				ctx.prisma.blocks.deleteMany({
					where: {
						id: {
							in: blocks.map(block => block.id),
						},
					},
				}),
				ctx.prisma.blocks.createMany({
					data: blocks,
				}),
			])

			return {
				success: true,
			}
		},
	})
	.mutation('delete', {
		meta: {
			hasAuth: true,
		},
		input: z.object({
			objectUrl: z.string(),
			recordingId: z.string(),
		}),
		resolve: async ({ ctx, input }) => {
			const deleteBlock = await ctx.prisma.blocks.deleteMany({
				where: {
					objectUrl: input.objectUrl,
					recordingId: input.recordingId,
				},
			})
			return { success: true.valueOf, deleteCount: deleteBlock.count }
		},
	})

export default blockRouter
