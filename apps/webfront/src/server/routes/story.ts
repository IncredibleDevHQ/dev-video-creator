import * as trpc from '@trpc/server'
import { TRPCError } from '@trpc/server'

import { z } from 'zod'
// eslint-disable-next-line import/no-extraneous-dependencies
import * as uuid from 'uuid'
import * as Y from 'yjs'
import { TiptapTransformer } from '@hocuspocus/transformer'
import VideoBlock from 'editor/src/nodes/extension-video'
import Paragraph from '@tiptap/extension-paragraph'
import Document from '@tiptap/extension-document'
import Text from '@tiptap/extension-text'

import serverEnvs from 'src/utils/env'
import axios from 'axios'
import type { Context } from '../createContext'
import {
	BlockMeta,
	BlockParticipant,
	ContentTypeEnum,
	createLiveBlocksRoom,
	CreateMuxAsset,
	DeleteMuxAsset,
	EditorState,
	FlickScopeEnum,
	FragmentTypeEnum,
	getBlockTitle,
	initRedisWithDataConfig,
	Meta,
	validateEmail,
} from '../utils/helpers'
import {
	NotifyOnPublishMailConfig,
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

	.mutation('createFragment', {
		meta: {
			hasAuth: true,
		},
		input: z.object({
			flickId: z.string(),
			name: z.string().default('Untitled'),
			type: z.nativeEnum(FragmentTypeEnum).default(FragmentTypeEnum.Landscape),
		}),
		output: z.object({
			fragmentId: z.string(),
			type: z.nativeEnum(FragmentTypeEnum),
		}),
		resolve: async ({ ctx, input }) => {
			// check if the user is a participant
			const participants = await ctx.prisma.participant.findMany({
				where: {
					flickId: input.flickId,
				},
				select: {
					userSub: true,
				},
			})

			const isParticipant = participants.find(p => p.userSub === ctx.user!.sub)
			if (!isParticipant)
				throw new TRPCError({
					message: 'You are not a participant of this flick',
					code: 'UNAUTHORIZED',
				})

			const editorState = {
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
			// add the fragment to the database
			const fragment = await ctx.prisma.fragment.create({
				data: {
					name: input.name,
					flickId: input.flickId,
					type: input.type,
					editorState,
				},
				select: {
					id: true,
					type: true,
				},
			})
			// update redis for hocuspocus
			await initRedisWithDataConfig(fragment.id, editorState)

			return {
				fragmentId: fragment.id,
				type: fragment.type as FragmentTypeEnum,
			}
		},
	})
	// TODO: Add s3 cleanup on delete
	.mutation('deleteFragment', {
		meta: {
			hasAuth: true,
		},
		input: z.object({
			flickId: z.string(),
			fragmentId: z.string(),
		}),
		output: z.object({
			fragmentId: z.string(),
			success: z.boolean(),
		}),
		resolve: async ({ ctx, input }) => {
			// check if the user is a participant
			const participants = await ctx.prisma.flick.findUnique({
				where: {
					id: input.flickId,
				},
				include: {
					Participants: true,
				},
			})
			if (!participants)
				throw new TRPCError({
					message: 'Story not found!',
					code: 'NOT_FOUND',
				})
			const isParticipant = participants.Participants.find(
				p => p.userSub === ctx.user!.sub
			)
			if (!isParticipant)
				throw new TRPCError({
					message: 'You are not a participant of this story.',
					code: 'UNAUTHORIZED',
				})
			// delete the fragment
			const fragment = await ctx.prisma.fragment.delete({
				where: {
					id: input.fragmentId,
				},
				select: {
					id: true,
				},
			})

			return {
				fragmentId: fragment.id,
				success: true,
			}
		},
	})
	.mutation('updateFragment', {
		meta: {
			hasAuth: true,
		},
		input: z.object({
			fragmentId: z.string(),
			name: z.string().optional(),
		}),
		resolve: async ({ ctx, input }) => {
			const fragment = await ctx.prisma.fragment.update({
				where: {
					id: input.fragmentId,
				},
				data: {
					name: input.name,
				},
			})
			return {
				id: fragment.id,
			}
		},
	})

	.mutation('publish', {
		meta: { hasAuth: true },
		input: z.object({
			data: z.object({
				title: z.string(),
				description: z.string(),
				thumbnail: z.object({
					objectId: z.string(),
					method: z.enum(['generated', 'uploaded']),
				}),
				cta: z.array(
					z.object({
						seconds: z.number(),
						text: z.string().optional(),
						url: z.string().optional(),
					})
				),
				blocks: z.array(
					z.object({
						id: z.string(),
						playbackDuration: z.number(),
						thumbnail: z.string().optional(),
						title: z.string(),
						type: z.string(),
						participants: z.array(
							z.object({
								username: z.string(),
								displayName: z.string(),
								picture: z.string(),
							})
						),
					})
				),
				discordCTA: z.object({ url: z.string(), text: z.string() }).optional(),
			}),
			fragmentId: z.string(),
			recordingId: z.string(),
			publishToYoutube: z.boolean().optional().default(false),
		}),
		resolve: async ({ ctx, input }) => {
			let { data } = input
			// check if user is participant
			const fragmentData = await ctx.prisma.fragment.findUnique({
				where: {
					id: input.fragmentId,
				},
				select: {
					id: true,
					editorState: true,
					type: true,
					Recording: {
						select: {
							id: true,
							url: true,
							Blocks: {
								select: {
									id: true,
									thumbnail: true,
									playbackDuration: true,
								},
							},
						},
					},
					Flick: {
						select: {
							id: true,
							ownerId: true,
							joinLink: true,
							name: true,
							Participants: {
								select: {
									id: true,
									userSub: true,
									User: {
										select: {
											username: true,
											displayName: true,
											email: true,
											picture: true,
										},
									},
								},
							},
						},
					},
				},
			})
			if (!fragmentData)
				throw new TRPCError({
					message: 'Video not found!',
					code: 'NOT_FOUND',
				})
			const ownerParticipant = fragmentData.Flick.Participants.find(
				p => p.userSub === ctx.user!.sub
			)

			// allow only flick owner to publish the video
			if (
				!ownerParticipant ||
				ownerParticipant.id !== fragmentData.Flick.ownerId
			)
				throw new TRPCError({
					code: 'UNAUTHORIZED',
					message:
						'You can not publish this story.Please contact the owner of this story to publish.',
				})

			// TODO: check if this typecast works correctly
			const dataConfig = fragmentData.editorState as EditorState

			if (!dataConfig || !dataConfig.blocks)
				throw new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: 'No blocks found in the story.',
				})

			if (!fragmentData.Recording?.[0].url) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message:
						'No recording found in the story.Produce the video before publishing.',
				})
			}
			// Check and publish to youtube
			const publishToYoutube = input.publishToYoutube || false
			if (publishToYoutube) {
				const headers = {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${ctx.user?.token}`,
				}

				try {
					// make req to youtube upload microservice
					axios.post(
						`${serverEnvs.INTEGRATIONS__URL}/youtube/upload`,
						{
							recordingId: fragmentData.Recording[0].id,
						},
						{
							headers,
						}
					)
				} catch (e) {
					console.log(`Failed to publish to youtube: ${e}`)
					// TODO: should i throw error here and break the flow?
					// Sentry.captureException('YT_ERR:' + JSON.stringify(e))
				}
			}
			// Check if the video is already published

			/*
        PREPARE METADATA FOR PUBLISH
    */
			/*
    - code blocks should have base64 encoded data
    - participants per block ( name , picture )
    - title for each block
    */
			const blockMeta: BlockMeta[] | undefined = []
			dataConfig.blocks.forEach(block => {
				let meta: BlockMeta
				// Interaction Blocks are not recordable but are present in the final meta
				if (block.type === 'interactionBlock') {
					meta = {
						id: block.id,
						title: getBlockTitle(block),
						type: block.type,
						participants: [],
						playbackDuration: 0,
						interactionType: block.interactionBlock?.type,
						interactionUrl: block.interactionBlock?.url,
						code: undefined,
					}
					meta.interactionUrl = block.interactionBlock?.url
					meta.interactionType = block.interactionBlock?.interactionType
				} else {
					meta = fragmentData.Recording?.[0].Blocks.find(b => {
						if (b.id !== block.id) {
							console.log(
								'AST Block = ',
								block.id,
								' was not found in Block Table'
							)
						}
						return b.id === block.id
					}) as BlockMeta

					if (!meta) {
						// Sentry.captureEvent({
						// 	message:
						// 		'Block on BlockTable not found in AST when trying to publish',
						// })
						return
					}

					meta.type = block.type

					if (meta.type === 'introBlock') meta.title = 'Introduction'
					else if (meta.type === 'outroBlock') meta.title = 'End'
					// @ts-ignore
					else meta.title = getBlockTitle(block) // block[`${meta.type}`].title;

					meta.participants = fragmentData.Flick.Participants.map(
						p =>
							({
								username: p.User.username,
								displayName: p.User.displayName,
								picture: p.User.picture,
							} as BlockParticipant)
					)

					// [fragmentData.Flick.owner?.user as BlockParticipant] || null

					if (meta.type === 'codeBlock') {
						meta.code = block.codeBlock?.code
					}
				}

				if (meta) blockMeta.push(meta as BlockMeta)
			})

			// update block durations in BlockMeta to be cumulative
			let elapsed = 0
			blockMeta.forEach(b => {
				const tmp = b.playbackDuration
				// adding buffer duration to the start time of the block so that on the player,
				// seeking to a video block which appears after a interactive block does not trigger the interaction which happen automatically
				// at that timestamp.
				// eslint-disable-next-line no-param-reassign
				b.playbackDuration = elapsed + 0.1 // TODO: Rename , this is actually the block start time and not duration
				elapsed += tmp
			})

			data = { ...data, blocks: blockMeta } as any

			let contentType: ContentTypeEnum
			switch (fragmentData.type) {
				case FragmentTypeEnum.Landscape:
					contentType = ContentTypeEnum.Video
					break
				case FragmentTypeEnum.Portrait:
					contentType = ContentTypeEnum.VerticalVideo
					break
				default:
					contentType = ContentTypeEnum.Video
			}

			/*
        Check if this recording is already published to content table
     */
			const contentCheck = await ctx.prisma.content.findMany({
				where: {
					type: contentType,
					fragmentId: fragmentData.id,
				},
				select: {
					id: true,
					resource: true,
					type: true,
				},
			})

			// if content is already published
			if (contentCheck.length > 0) {
				console.log('Performing re-publish of video...')

				// check if the recorded video has changed
				if (fragmentData.Recording[0].url !== contentCheck[0].resource) {
					console.log(
						`Detected change in recording url, ${fragmentData.Recording[0].url} !== ${contentCheck[0].resource} publishing new video...`
					)
					// video resource has change
					// cleanup+update mux and
					console.log('Cleaning up mux old assets...')
					await DeleteMuxAsset(contentCheck?.[0].id, ctx.prisma)
					// generate new mux link
					/*
            ADD VIDEO TO MUX AND GET A STREAMING URL
        */
					console.log('Initiating mux for new video ...')
					const muxPlaybackId = await CreateMuxAsset(
						ctx.prisma,
						fragmentData.Recording[0].url,
						contentCheck[0].id
					)

					console.log(
						'Updating published content with new link mux link: ',
						muxPlaybackId.id
					)

					// TODO: Verify the below is working as expected. Check for JSON field and update
					await ctx.prisma.content.upsert({
						create: {
							flickId: fragmentData.Flick.id,
							fragmentId: input.fragmentId,
							type: contentType,
							data,
							resource: fragmentData.Recording[0].url,
							isPublic: true,
							published_at: new Date().toISOString(),
							thumbnail: data.thumbnail?.objectId,
						},
						update: {
							data,
							resource: fragmentData.Recording[0].url,
							isPublic: true,
							published_at: new Date().toISOString(),
							thumbnail: data.thumbnail?.objectId,
						},
						where: {
							fragmentId: input.fragmentId,
						},
					})

					// segment.track({
					//   event: "Publish",
					//   userId: req.user?.decoded?.email,
					//   properties: {
					//     title: data.title,
					//     storyId: fragmentDetails.data?.Fragment[0].flick.id,
					//     contentId: content.data?.insert_Content_one?.id,
					//     notebookId: params.fragmentId,
					//     muxPlaybackId: muxPlaybackId.id,
					//     firstPublish: false,
					//     transcoded: true,
					//     contentType: fragmentDetails.data.Fragment[0].type,
					//     // TODO: add visibility once
					//   },
					// });
				} else {
					// if not changed update only other info
					console.log(
						`Detected change in publish meta-data only for content id: ${contentCheck[0].id}, skipping mux...`
					)
					// only meta-data has changed, update the everything except resource
					// store data to content table
					await ctx.prisma.content.create({
						data: {
							flickId: fragmentData.Flick.id,
							fragmentId: input.fragmentId,
							isPublic: true,
							published_at: new Date().toISOString(),
							thumbnail: data.thumbnail?.objectId,
							type: contentType,
							resource: contentCheck[0].resource, // retain url/mux-id and re-publish all related meta info
							data,
						},
					})

					// segment.track({
					//   event: "Publish",
					//   userId: req.user?.decoded?.email,
					//   properties: {
					//     title: data.title,
					//     storyId: fragmentDetails.data?.Fragment[0].flick.id,
					//     contentId: content.data?.insert_Content_one?.id,
					//     notebookId: params.fragmentId,
					//     firstPublish: false,
					//     transcoded: false,
					//     contentType: fragmentDetails.data.Fragment[0].type,
					//     // TODO: add visibility once
					//   },
					// });
				}
			} else {
				/*
          First time publishing fragment
      */
				// store data to content table
				const content = await ctx.prisma.content.create({
					data: {
						flickId: fragmentData.Flick.id,
						fragmentId: input.fragmentId,
						isPublic: true,
						published_at: new Date().toISOString(),
						thumbnail: data.thumbnail?.objectId,
						type: contentType,
						resource: contentCheck[0].resource, // retain url/mux-id and re-publish all related meta info
						data,
					},
					select: {
						id: true,
					},
				})
				// ADD VIDEO TO MUX AND GET A STREAMING URL
				const muxPlaybackId = await CreateMuxAsset(
					ctx.prisma,
					fragmentData.Recording[0].url,
					content.id
				)
				console.log('Added new Video to Mux : ', muxPlaybackId)

				// track first publish to segment
				// segment.track({
				// 	event: 'Publish',
				// 	userId: req.user?.decoded?.email,
				// 	properties: {
				// 		title: data.title,
				// 		storyId: fragmentDetails.data?.Fragment[0].flick.id,
				// 		contentId: content.data?.insert_Content_one?.id,
				// 		notebookId: params.fragmentId,
				// 		muxPlaybackId: muxPlaybackId.id,
				// 		firstPublish: true,
				// 		transcoded: true,
				// 		contentType: fragmentDetails.data.Fragment[0].type,
				// 		// TODO: add visibility once
				// 	},
				// })
			}

			// Send email update to all participants
			const sendToEmails: string[] = []

			fragmentData.Flick.Participants.forEach((p, idx) => {
				if (idx > 14) return // Note customer.io allows upto 15 emails in a single request (including both bcc and to)
				if (p.User.email && validateEmail(p.User.email))
					sendToEmails.push(p.User.email)
			})
			console.log('Sending email to: ', sendToEmails)
			sendToEmails.forEach(email => {
				// TODO: this may need to be awaited as it is async and serverless may kill proc preemptively
				sendTransactionalEmail({
					mailType: TransactionalMailType.NOTIFY_PUBLISH,
					sendToEmail: email,
					messageData: {
						btnUrl: `${serverEnvs.NEXT_PUBLIC_BASE_URL}/watch/${fragmentData.Flick.joinLink}`,
						storyTitle: fragmentData.Flick.name,
					} as NotifyOnPublishMailConfig,
				})
			})
			return {
				success: true,
			}
		},
	})

export default storyRouter
