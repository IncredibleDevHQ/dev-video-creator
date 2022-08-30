// Copyright 2022 Pixelbyte Studio Pvt Ltd
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.



import { TRPCError } from '@trpc/server'
import * as trpc from '@trpc/server'
import axios from 'axios'
import { z } from 'zod'
// eslint-disable-next-line import/no-extraneous-dependencies
import * as uuid from 'uuid'
import { createClient, LiveMap, LiveObject } from '@liveblocks/client'
// eslint-disable-next-line import/no-extraneous-dependencies
import WebSocket from 'ws'
import {
	ContentTypeEnum,
	FragmentTypeEnum,
	ParticipantRoleEnum,
} from 'utils/src/enums'
import {
	sendTransactionalEmail,
	TransactionalMailType,
	NotifyOnPublishMailConfig,
} from '../utils/transactionalEmail'
import type { Context } from '../createContext'
import {
	BlockMeta,
	BlockParticipant,
	CreateMuxAsset,
	DeleteMuxAsset,
	EditorState,
	getBlockTitle,
	initRedisWithDataConfig,
	Meta,
	validateEmail,
} from '../utils/helpers'
import serverEnvs from '../utils/env'

const fragmentRouter = trpc
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
	.mutation('get', {
		meta: {
			hasAuth: true,
		},
		input: z.object({
			id: z.string(),
		}),
		resolve: async ({ input, ctx }) => {
			const { id } = input

			const fragment = await ctx.prisma.fragment.findUnique({
				where: {
					id,
				},
				select: {
					configuration: true,
					description: true,
					flickId: true,
					id: true,
					name: true,
					order: true,
					type: true,
					producedLink: true,
					producedShortsLink: true,
					editorState: true,
					editorValue: true,
					encodedEditorValue: true,
					thumbnailConfig: true,
					thumbnailObject: true,
					publishConfig: true,
					version: true,
					Blocks: {
						select: {
							id: true,
							objectUrl: true,
							recordingId: true,
							thumbnail: true,
							playbackDuration: true,
						},
					},
					Flick: {
						select: {
							name: true,
							description: true,
						},
					},
					Recording: {
						select: {
							id: true,
						},
					},
				},
			})

			if (!fragment) {
				throw new TRPCError({
					code: 'NOT_FOUND',
					message: 'Fragment not found',
				})
			}

			return fragment
		},
	})
	// ACTIONS
	.mutation('create', {
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

			// update liveblocks
			const client = createClient({
				publicApiKey: serverEnvs.LIVEBLOCKS_PUBLIC_KEY,
				polyfills: {
					fetch: fetch as any,
					WebSocket,
					atob(data) {
						return Buffer.from(data, 'base64').toString('binary')
					},
				},
			})

			const room = client.enter(`story-${input.flickId}`, {
				initialPresence: {
					user: {
						id: 'server',
						name: 'server',
						picture: 'server',
					},
					page: 'Notebook',
					cursor: { x: 0, y: 0 },
					inHuddle: false,
				},
			})

			const currentViewConfig = (await room.getStorage()).root.get(
				'viewConfig'
			) as LiveMap<string, any>

			const introBlockId = editorState?.blocks?.find(
				(b: any) => b.type === 'introBlock'
			)?.id
			const outroBlockId = editorState?.blocks?.find(
				(b: any) => b.type === 'outroBlock'
			)?.id
			if (!introBlockId || !outroBlockId)
				throw new Error('introBlockId or outroBlockId not found')

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

			const liveBlocks = new LiveMap()
			Object.entries(blocks).forEach(([id, value]) => {
				liveBlocks.set(id, value)
			})

			const fragmentViewConfig = {
				selectedBlocks: [],
				continuousRecording: false,
				mode: input.type,
				speakers: [participants],
				blocks: liveBlocks,
			}

			currentViewConfig.set(fragment.id, new LiveObject(fragmentViewConfig))
			client.leave(`story-${input.flickId}`)

			// update redis for hocuspocus
			await initRedisWithDataConfig(fragment.id, editorState, undefined)

			// add default recording
			await ctx.prisma.recording.create({
				data: {
					flickId: input.flickId,
					fragmentId: fragment.id,
					type: ContentTypeEnum.Video,
					editorState,
					viewConfig: JSON.parse(JSON.stringify(fragmentViewConfig)),
					status: 'pending',
				},
			})

			return {
				fragmentId: fragment.id,
				type: fragment.type as FragmentTypeEnum,
			}
		},
	})
	// TODO: Add s3 cleanup on delete
	.mutation('delete', {
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
	.mutation('update', {
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
		// modeled after IPublish interface in flick.store
		input: z.object({
			data: z.object({
				title: z.string().optional(),
				description: z.string().optional(),
				thumbnail: z
					.object({
						objectId: z.string().optional(),
						method: z.enum(['generated', 'uploaded']),
					})
					.optional(),
				cta: z
					.array(
						z.object({
							seconds: z.number(),
							text: z.string().optional(),
							url: z.string().optional(),
						})
					)
					.optional(),
				blocks: z
					.array(
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
					)
					.optional(),
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
							ownerSub: true,
							joinLink: true,
							name: true,
							Participants: {
								select: {
									id: true,
									userSub: true,
									role: true,
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
				ownerParticipant?.role !== ParticipantRoleEnum.Host ||
				ownerParticipant?.userSub !== fragmentData.Flick.ownerSub
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
						`${serverEnvs.INTEGRATIONS_URL}/youtube/upload`,
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
					await ctx.prisma.content.update({
						where: {
							id: contentCheck[0].id,
						},
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
				const recording = await ctx.prisma.recording.findUnique({
					where: {
						id: input.recordingId,
					},
					select: {
						url: true,
					},
				})
				// store data to content table
				const content = await ctx.prisma.content.create({
					data: {
						flickId: fragmentData.Flick.id,
						fragmentId: input.fragmentId,
						isPublic: true,
						published_at: new Date().toISOString(),
						thumbnail: data.thumbnail?.objectId,
						type: contentType,
						resource: recording?.url as string, // retain url/mux-id and re-publish all related meta info
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
	.mutation('updatePublished', {
		meta: {
			hasAuth: true,
		},
		input: z.object({
			id: z.string(),
			publishConfig: z.any(),
		}),
		resolve: async ({ input, ctx }) => {
			await ctx.prisma.fragment.update({
				where: {
					id: input.id,
				},
				data: {
					publishConfig: input.publishConfig,
				},
			})
			return {
				success: true,
			}
		},
	})
	.mutation('updateThumbnail', {
		meta: {
			hasAuth: true,
		},
		input: z.object({
			id: z.string(),
			thumbnailConfig: z.any().optional(),
			thumbnailObject: z.string().optional(),
		}),
		resolve: async ({ ctx, input }) => {
			const updatedFragment = await ctx.prisma.fragment.update({
				where: {
					id: input.id,
				},
				data: {
					thumbnailConfig: input.thumbnailConfig || undefined,
					thumbnailObject: input.thumbnailObject || undefined,
				},
			})
			return { success: true, data: { id: updatedFragment.id } }
		},
	})
	.mutation('updateName', {
		meta: {
			hasAuth: true,
		},
		input: z.object({
			id: z.string(),
			name: z.string(),
		}),
		resolve: async ({ ctx, input }) => {
			const updatedFragment = await ctx.prisma.fragment.update({
				where: {
					id: input.id,
				},
				data: {
					name: input.name,
				},
			})
			return { success: true, data: { id: updatedFragment.id } }
		},
	})
export default fragmentRouter
