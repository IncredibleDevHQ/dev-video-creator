import * as trpc from '@trpc/server'
import { TRPCError } from '@trpc/server'

import { z } from 'zod'

import * as Y from 'yjs'
import { TiptapTransformer } from '@hocuspocus/transformer'
import VideoBlock from 'editor/src/nodes/extension-video'
import Paragraph from '@tiptap/extension-paragraph'
import Document from '@tiptap/extension-document'
import Text from '@tiptap/extension-text'
// eslint-disable-next-line import/no-extraneous-dependencies
import * as uuid from 'uuid'
import serverEnvs from 'src/utils/env'
import type { Context } from '../createContext'
import {
	createLiveBlocksRoom,
	initRedisWithDataConfig,
	Meta,
} from '../utils/helpers'
import { FlickScopeEnum } from '../utils/enums'
import {
	sendTransactionalEmail,
	TransactionalMailType,
} from '../utils/transactionalEmail'

const storyRouter = trpc
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
	.mutation('create', {
		meta: {
			hasAuth: true,
		},
		input: z.object({
			sub: z.string(),
			name: z.string(),
			description: z.string().optional(),
			scope: z.nativeEnum(FlickScopeEnum).default(FlickScopeEnum.Private),
			configuration: z.any().optional(),
			organisationSlug: z.string().optional(),
			seriesId: z.string().optional(),
			dirty: z.boolean().optional().default(false),
			themeName: z.string().optional().default('DarkGradient'),
			brandingId: z.string().optional(),
			useBranding: z.boolean().optional().default(false),
			creationFlow: z.string().optional().default('Notebook'),
			fragmentViewConfig: z.any().optional(),
			fragmentDataConfig: z.any().optional(),
			fragmentEncodedEditorValue: z.any().optional(),
		}),
		output: z.object({
			id: z.string(),
			fragmentId: z.string(),
		}),
		resolve: async ({ input, ctx }) => {
			if (!ctx.user?.sub)
				throw new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: 'Story creation failed',
				})
			// check if_Series and series ownership
			if (input.seriesId) {
				// get series owner and story count
				const series = await ctx.prisma.series.findUnique({
					where: {
						id: input.seriesId,
					},
					select: {
						id: true,
						ownerSub: true,
					},
				})
				if (series?.ownerSub !== ctx.user!.sub)
					throw new TRPCError({
						code: 'UNAUTHORIZED',
						message: 'You are not authorized to add this story to this series',
					})
			}

			// check if_Organisation and organisation ownership
			if (input.organisationSlug) {
				const org = await ctx.prisma.organisation.findUnique({
					where: {
						slug: input.organisationSlug,
					},
				})

				if (org && org.ownerId !== ctx.user!.sub)
					throw new TRPCError({
						code: 'UNAUTHORIZED',
						message: 'You are not the owner of this organization.',
						cause: 'Insufficient Permissions',
					})
			}

			// setup fallback for data config if not present
			if (!input.fragmentDataConfig) {
				// eslint-disable-next-line no-param-reassign
				input.fragmentDataConfig = {
					blocks: [
						{
							id: uuid.v4(),
							type: 'introBlock',
							pos: 0,
							introBlock: {},
						},
						{
							id: uuid.v4(),
							type: 'outroBlock',
							pos: 1,
						},
					],
				}
			}

			// Create new story|flick
			const story = await ctx.prisma.flick.create({
				data: {
					...input,
				},
				select: {
					id: true,
					name: true,
				},
			})

			//  Insert owner onto participant table
			const ownerParticipant = await ctx.prisma.participant.create({
				data: {
					flickId: story.id,
					createdAt: new Date(),
					updatedAt: new Date(),
					userSub: ctx.user!.sub,
					role: 'Host',
				},
				select: {
					id: true,
					User: {
						select: { email: true, displayName: true },
					},
				},
			})

			// update flick table with owner participant id as ownerId
			await ctx.prisma.flick.update({
				where: {
					id: story.id,
				},
				data: {
					ownerId: ownerParticipant.id,
				},
			})

			// Add default fragment to flick
			const fragment = await ctx.prisma.fragment.create({
				data: {
					flickId: story.id,
					configuration: input.fragmentViewConfig,
					editorState: input.fragmentDataConfig,
					encodedEditorValue: input.fragmentEncodedEditorValue,
					name: 'Untitled', // TODO: make this fun!
					order: 0,
					type: null,
				},
				select: {
					id: true,
				},
			})

			const introBlockId = input.fragmentDataConfig?.blocks?.find(
				(b: any) => b.type === 'introBlock'
			)?.id
			const outroBlockId = input.fragmentDataConfig?.blocks?.find(
				(b: any) => b.type === 'outroBlock'
			)?.id

			// Setup fallback view config if not present
			// create the default view config
			if (!input.fragmentViewConfig) {
				const blocks = {
					[introBlockId]: {
						layout: 'classic',
						view: {
							type: 'introBlock',
							intro: {
								order: [
									{ enabled: true, state: 'userMedia' },
									{ enabled: true, state: 'titleSplash' },
								],
							},
						},
					},
					[outroBlockId]: {
						layout: 'classic',
						view: {
							type: 'outroBlock',
							outro: {
								order: [{ enabled: true, state: 'titleSplash' }],
							},
						},
					},
				}
				// eslint-disable-next-line no-param-reassign
				input.fragmentViewConfig = {
					selectedBlocks: [],
					continuousRecording: false,
					mode: 'Landscape',
					speakers: ownerParticipant,
					blocks,
				}
			}
			// re-srctructure the view config for liveblocks
			const roomId = `story-${story.id}`
			const obj: any = {}
			obj[fragment.id] = {
				liveblocksType: 'LiveObject',
				data: {
					...input.fragmentViewConfig,
					blocks: {
						liveblocksType: 'LiveMap',
						data: input.fragmentViewConfig.blocks,
					},
				},
			}

			// construct the payload for liveblocks
			const payload: any = {}
			payload[introBlockId] = {
				liveblocksType: 'LiveObject',
				data: {
					activeIntroIndex: 0,
				},
			}
			payload[outroBlockId] = {
				liveblocksType: 'LiveObject',
				data: {
					activeOutroIndex: 0,
				},
			}

			// create the room on liveblocks and init with data
			await createLiveBlocksRoom(roomId, obj, payload)

			// Init yjs binary layer
			let raw
			let redisBody: any = {
				ast: input.fragmentDataConfig,
			}
			if (input.fragmentEncodedEditorValue) {
				const yDoc = TiptapTransformer.extensions([
					VideoBlock,
					Document,
					Text,
					Paragraph,
				]).toYdoc(
					JSON.parse(
						Buffer.from(input.fragmentEncodedEditorValue, 'base64').toString(
							'utf8'
						)
					)
				)
				const state = Buffer.from(Y.encodeStateAsUpdate(yDoc))
				raw = Buffer.from(state).toString('binary')
				redisBody = {
					...redisBody,
					raw,
				}
			}
			// Init redis on flick create with initial ast(data-config)
			await initRedisWithDataConfig(story.id, redisBody)

			// Send notification email to owner
			try {
				if (!ownerParticipant.User.email) throw new Error('No email found')
				await sendTransactionalEmail({
					mailType: TransactionalMailType.CREATE_STORY,
					sendToEmail: ownerParticipant.User.email,
					messageData: {
						storyTitle: story.name,
						receiverName: ownerParticipant.User.displayName as string,
						btnUrl: `${serverEnvs.STUDIO_ENDPOINT}/story/${story.id}`,
					},
				})
			} catch (e) {
				// TODO: capture on sentry and don't throw as its non-fatal error
			}

			// if_Series add to series
			if (input.seriesId) {
				const seriesStoryCount = await ctx.prisma.flick_Series.count({
					where: {
						seriesId: input.seriesId,
					},
				})
				await ctx.prisma.flick_Series.create({
					data: {
						seriesId: input.seriesId,
						flickId: story.id,
						order: seriesStoryCount || 0,
					},
				})
			}

			return {
				id: story.id,
				fragmentId: fragment.id,
			}
		},
	})
	// TODO: Add s3 cleanup on delete
	.mutation('delete', {
		meta: {
			hasAuth: true,
		},
		input: z.object({ flickId: z.string() }),
		output: z.object({ flickId: z.string() }),
		resolve: async ({ input, ctx }) => {
			// check if user is flickOwner
			const flick = await ctx.prisma.flick.findUnique({
				where: {
					id: input.flickId,
				},
				select: {
					ownerId: true,
				},
			})
			const userParticipantId = await ctx.prisma.participant.findFirst({
				where: {
					flickId: input.flickId,
					userSub: ctx.user!.sub,
				},
				select: {
					id: true,
				},
			})
			if (flick?.ownerId !== userParticipantId?.id) {
				throw new TRPCError({
					code: 'UNAUTHORIZED',
					message:
						'You are not authorized to delete this story.Contact the owner of the story.',
				})
			}
			// delete the story
			const story = await ctx.prisma.flick.delete({
				where: {
					id: input.flickId,
				},
			})
			return {
				flickId: story.id,
			}
		},
	})
	.mutation('update', {
		meta: {
			hasAuth: true,
		},
		input: z.object({
			id: z.string().optional(),
			name: z.string().optional(),
			organisationSlug: z.string().optional(),
			scope: z.nativeEnum(FlickScopeEnum).optional(),
		}),
		resolve: async ({ input, ctx }) => {
			const flick = await ctx.prisma.flick.update({
				where: {
					id: input.id,
				},
				data: {
					name: input.name,
					organisationSlug: input.organisationSlug,
					scope: input.scope,
				},
				select: {
					id: true,
				},
			})
			return {
				id: flick.id,
			}
		},
	})

export default storyRouter
