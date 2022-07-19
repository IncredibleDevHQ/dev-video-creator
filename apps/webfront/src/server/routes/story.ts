import * as trpc from '@trpc/server'
import { TRPCError } from '@trpc/server'

import { z } from 'zod'

import serverEnvs from 'src/utils/env'
import { nanoid } from 'nanoid'
import type { Context } from '../createContext'
import {
	defaultDataConfig,
	getDefaultViewConfig,
	createLiveBlocksRoom,
	initRedisWithDataConfig,
	Meta,
} from '../utils/helpers'
import { FlickScopeEnum, ParticipantRoleEnum } from '../utils/enums'
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
	.query('presentationConfig', {
		meta: {
			hasAuth: false,
		},
		input: z.object({
			fragmentId: z.string(),
		}),
		resolve: async ({ ctx, input }) => {
			const config = await ctx.prisma.fragment.findUnique({
				where: {
					id: input.fragmentId,
				},
				select: {
					editorState: true,
					configuration: true,
					Flick: {
						select: {
							id: true,
							name: true,
							themeName: true,
							Branding: {
								select: {
									id: true,
									branding: true,
								},
							},
						},
					},
				},
			})
			const owner = await ctx.prisma.participant.findMany({
				where: {
					flickId: config?.Flick.id,
					role: ParticipantRoleEnum.Host,
				},
				select: {
					User: {
						select: {
							displayName: true,
							picture: true,
							organization: true,
							designation: true,
							username: true,
						},
					},
				},
			})
			return {
				configuration: config?.configuration,
				editorState: config?.editorState,
				flick: config?.Flick,
				owner: owner?.[0]?.User,
			}
		},
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
				input.fragmentDataConfig = defaultDataConfig
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
					role: ParticipantRoleEnum.Host,
				},
				select: {
					id: true,
					status: true,
					role: true,
					userSub: true,
					inviteStatus: true,
					User: {
						select: {
							sub: true,
							email: true,
							displayName: true,
							picture: true,
							username: true,
						},
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
				// eslint-disable-next-line no-param-reassign
				input.fragmentViewConfig = getDefaultViewConfig(
					introBlockId,
					outroBlockId,
					ownerParticipant
				)
			}
			try {
				// init liveblocks
				await createLiveBlocksRoom(
					story.id,
					fragment.id,
					input.fragmentViewConfig,
					introBlockId,
					outroBlockId
				)
			} catch (e) {
				// TODO: Sentry error logging
				throw new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: 'Story creation failed',
					cause: JSON.stringify(e),
				})
			}

			// Init redis on flick create with initial ast(data-config)
			try {
				await initRedisWithDataConfig(
					fragment.id,
					input.fragmentDataConfig,
					input.fragmentEncodedEditorValue
				)
			} catch (e) {
				// TODO: Sentry error logging
				throw new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: 'Story creation failed',
					cause: JSON.stringify(e),
				})
			}

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
	.mutation('duplicate', {
		meta: {
			hasAuth: true,
		},
		input: z.object({
			flickId: z.string(),
		}),
		resolve: async ({ input, ctx }) => {
			if (!ctx.user?.sub)
				throw new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: 'Story creation failed',
				})
			// check if use requester is the owner of the flick
			const flick = await ctx.prisma.flick.findUnique({
				where: {
					id: input.flickId,
				},
				select: {
					name: true,
					description: true,
					scope: true,
					configuration: true,
					dirty: true,
					themeName: true,
					brandingId: true,
					useBranding: true,
					ownerId: true,
					Participants: {
						select: {
							id: true,
							userSub: true,
							status: true,
							role: true,
							inviteStatus: true,
							User: {
								select: {
									sub: true,
									email: true,
									displayName: true,
									picture: true,
									username: true,
								},
							},
						},
					},
					Fragment: {
						select: {
							name: true,
							type: true,
							configuration: true,
							editorState: true,
							encodedEditorValue: true,
						},
					},
				},
			})
			if (!flick)
				throw new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: 'Story creation failed',
				})

			const ownerParticipant = flick.Participants.find(
				p => p.userSub === ctx.user!.sub
			)
			if (flick.ownerId !== ownerParticipant?.id) {
				throw new TRPCError({
					code: 'UNAUTHORIZED',
					message: 'You are not authorized to duplicate this story.',
				})
			}

			// create a new flick with existing data
			const newFlick = await ctx.prisma.flick.create({
				data: {
					name: `${flick.name} (copy)`,
					description: flick.description,
					scope: flick.scope,
					configuration: flick.configuration || undefined,
					dirty: flick.dirty,
					themeName: flick.themeName,
					brandingId: flick.brandingId,
					useBranding: flick.useBranding,
				},
				select: {
					id: true,
				},
			})

			// add owner as participant
			const newFlickOwner = await ctx.prisma.participant.create({
				data: {
					flickId: newFlick.id,
					createdAt: new Date(),
					updatedAt: new Date(),
					userSub: ctx.user!.sub,
					role: ParticipantRoleEnum.Host,
				},
				select: {
					id: true,
					userSub: true,
					status: true,
					role: true,
					inviteStatus: true,
					User: {
						select: {
							sub: true,
							email: true,
							displayName: true,
							picture: true,
							username: true,
						},
					},
				},
			})
			// update flick table with owner participant id as ownerId
			await ctx.prisma.flick.update({
				where: {
					id: newFlick.id,
				},
				data: {
					ownerId: newFlickOwner.id,
				},
			})
			// add fragments
			await ctx.prisma.fragment.createMany({
				data: flick.Fragment.map(f => ({
					flickId: newFlick.id,
					configuration:
						f.configuration ||
						getDefaultViewConfig(nanoid(), nanoid(), newFlickOwner),
					editorState: f.editorState || defaultDataConfig,
					encodedEditorValue: f.encodedEditorValue || undefined,
					name: f.name,
					type: f.type,
				})),
			})
			// add fragment data to live blocks and yjs redis
			const newFragments = await ctx.prisma.fragment.findMany({
				where: {
					flickId: newFlick.id,
				},
				select: {
					id: true,
					configuration: true,
					encodedEditorValue: true,
					editorState: true,
				},
			})
			newFragments.forEach(async f => {
				try {
					if (!f.configuration) throw Error('No configuration')
					const viewConfig = JSON.parse(f.configuration.toString())

					// init liveblocks
					const introBlockId: string = viewConfig.blocks?.find(
						(b: any) => b.type === 'introBlock'
					)?.id
					const outroBlockId: string = viewConfig.blocks?.find(
						(b: any) => b.type === 'outroBlock'
					)?.id

					await createLiveBlocksRoom(
						newFlick.id,
						f.id,
						viewConfig,
						introBlockId,
						outroBlockId
					)

					// Init redis on flick create with initial ast(data-config)
					await initRedisWithDataConfig(
						f.id,
						f.editorState,
						f.encodedEditorValue
					)
				} catch (e) {
					// TODO: Sentry error logging
					throw new TRPCError({
						code: 'INTERNAL_SERVER_ERROR',
						message: 'Story creation failed',
						cause: JSON.stringify(e),
					})
				}
				return {
					id: newFlick.id,
				}
			})
		},
	})
export default storyRouter
