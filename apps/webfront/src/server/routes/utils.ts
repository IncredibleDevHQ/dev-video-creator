import * as trpc from '@trpc/server'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'

import getStoragePath from 'src/utils/helpers/s3-path-builder'
import { s3 } from 'src/utils/aws'
import serverEnvs from 'src/utils/env'
import axios from 'axios'

import { UploadType } from 'utils/src/enums'
import { Context } from '../createContext'
import { Meta } from '../utils/helpers'
import { isKeyAllowed } from '../utils/upload'
import generateAgoraToken from '../utils/generateAgoraToken'

const utilsRouter = trpc
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
	// ACTIONS
	.query('searchUnsplash', {
		meta: {
			hasAuth: true,
		},
		input: z.object({
			query: z.string().optional(),
		}),
		resolve: async ({ input }) => {
			const unspashAccessKey = serverEnvs.UNSPLASH_ACCESS_KEY // config.services.unsplash.accesskey
			if (typeof input.query === 'undefined') {
				const { data } = await axios.get(
					`https://api.unsplash.com/photos?client_id=${unspashAccessKey}`
				)
				return data
			}

			const { data } = await axios.get(
				`https://api.unsplash.com/search/photos?query=${input.query}&client_id=${unspashAccessKey}&per_page=50`
			)
			return data.results
		},
	})
	.query('tokenizeCode', {
		meta: {
			hasAuth: true,
		},
		input: z.object({
			code: z.string(),
			language: z.string(),
			theme: z.string().default('dark_plus'),
		}),
		resolve: async ({ input, ctx }) => {
			if (!ctx.user?.sub)
				throw new TRPCError({
					code: 'UNAUTHORIZED',
				})
			const { endpoint, secret } = {
				endpoint: serverEnvs.TOKENIZE_ENDPOINT,
				secret: serverEnvs.TOKENIZE_SECRET,
			}
			try {
				const {
					data: { success, data },
				} = await axios.post(
					endpoint,
					{
						code: input.code,
						language: input.language,
						theme: input.theme,
					},
					{
						headers: {
							'x-secret': secret,
							'Content-Type': 'application/json',
						},
					}
				)
				return { data, success }
			} catch (e) {
				throw new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message:
						(e as any).response.message || (e as any).response.data.error,
				})
			}
		},
	})
	.query('themes', {
		meta: {
			hasAuth: true,
		},
		input: z
			.object({
				limit: z.number().default(25),
				offset: z.number().default(0),
			})
			.optional(),
		resolve: async ({ input, ctx }) => {
			const theme = ctx.prisma.theme.findMany({
				select: {
					name: true,
					config: true,
				},
				take: input?.limit || 25,
				skip: input?.offset || 0,
			})
			return theme
		},
	})
	.query('fonts', {
		meta: {
			hasAuth: true,
		},
		resolve: async ({ ctx }) => {
			if (!ctx.user?.sub) throw new TRPCError({ code: 'UNAUTHORIZED' })
			const fonts = await ctx.prisma.fonts.findMany({
				where: {
					userSub: ctx.user?.sub,
				},
				select: {
					id: true,
					family: true,
					url: true,
				},
			})
			return fonts
		},
	})
	/*
		MUTATIONS
	*/
	// ACTIONS
	.mutation('getRtcToken', {
		meta: {
			hasAuth: true,
		},
		input: z.object({
			flickId: z.string().optional(),
			fragmentId: z.string().optional(),
			huddle: z.boolean(),
		}),
		output: z.object({
			token: z.string(),
			success: z.boolean(),
		}),
		resolve: async ({ input, ctx }) => {
			// get flick participants
			const flickParticipants = await ctx.prisma.participant.findMany({
				where: {
					flickId: input.flickId,
				},
				select: {
					id: true,
					userSub: true,
				},
			})
			if (flickParticipants.length === 0) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: 'Invalid Request',
				})
			}

			const participant = flickParticipants.find(
				(p: { userSub: string }) => p.userSub === ctx.user!.sub
			)
			if (!participant) {
				throw new TRPCError({
					code: 'UNAUTHORIZED',
					message: 'You are not a participant of this story.',
				})
			}
			try {
				if (!input.flickId && !input.fragmentId)
					throw new TRPCError({
						code: 'BAD_REQUEST',
						message: 'Invalid Request',
					})

				const { token, success } = generateAgoraToken(
					input.huddle ? input.flickId! : input.fragmentId!,
					participant.id
				)
				return { token, success }
			} catch (e) {
				throw new TRPCError({
					code: e instanceof TRPCError ? e.code : 'INTERNAL_SERVER_ERROR',
					message:
						e instanceof TRPCError
							? e.message
							: 'Failed to generate RTC token.',
				})
			}
		},
	})
	.mutation('createBranding', {
		meta: {
			hasAuth: true,
		},
		input: z.object({
			name: z.string(),
			branding: z.any(),
		}),
		resolve: async ({ ctx, input }) => {
			if (!ctx.user?.sub) throw new TRPCError({ code: 'UNAUTHORIZED' })
			const brand = await ctx.prisma.branding.create({
				data: {
					name: input.name,
					branding: input.branding,
					userSub: ctx.user.sub,
				},
				select: {
					id: true,
					name: true,
					branding: true,
				},
			})
			return brand
		},
	})
	.mutation('updateBranding', {
		meta: {
			hasAuth: true,
		},
		input: z.object({
			id: z.string(),
			name: z.string().optional(),
			branding: z.any(),
		}),
		resolve: async ({ ctx, input }) => {
			const update = await ctx.prisma.branding.update({
				where: {
					id: input.id,
				},
				data: {
					name: input.branding.name || undefined,
					branding: input.branding,
				},
				select: {
					id: true,
				},
			})
			return { id: update.id }
		},
	})
	.mutation('deleteBranding', {
		meta: {
			hasAuth: true,
		},
		input: z.object({
			id: z.string(),
		}),
		resolve: async ({ ctx, input }) => {
			const deleted = await ctx.prisma.branding.delete({
				where: {
					id: input.id,
				},
				select: {
					id: true,
				},
			})
			return { id: deleted.id }
		},
	})
	.mutation('createFont', {
		meta: {
			hasAuth: true,
		},
		input: z.object({
			family: z.string(),
			url: z.string(),
		}),
		resolve: async ({ ctx, input }) => {
			if (!ctx.user?.sub) throw new TRPCError({ code: 'UNAUTHORIZED' })
			const font = await ctx.prisma.fonts.create({
				data: {
					family: input.family,
					url: input.url,
					userSub: ctx.user.sub,
				},
				select: {
					id: true,
					family: true,
					url: true,
				},
			})
			return font
		},
	})
	// Session cookie middleware
	// .middleware(({ meta, ctx, next }) => {
	// 	console.log('meta: ', meta)
	// 	console.log('ctx: ', ctx.user?.sub)
	// 	console.log('sess: ', ctx.sessionCookie)
	// 	// only check authorization if enabled
	// 	if (meta?.hasAuth && !ctx.user && !ctx.sessionCookie) {
	// 		throw new TRPCError({ code: 'UNAUTHORIZED' })
	// 	}

	// 	return next({
	// 		ctx: {
	// 			...ctx,
	// 			user: ctx.user ? ctx.user : ctx.sessionCookie,
	// 		},
	// 	})
	// })
	.mutation('getUploadUrl', {
		meta: {
			hasAuth: true,
		},
		input: z.object({
			key: z.string(),
			tag: z.nativeEnum(UploadType).nullish(),
			meta: z
				.object({
					flickId: z.string().optional(),
					fragmentId: z.string().optional(),
					brandId: z.string().optional(),
					recordingId: z.string().optional(),
					blockId: z.string().optional(),
				})
				.nullish(),
		}),
		resolve: async ({ input, ctx }) => {
			let uploadType: UploadType

			// validate upload tag
			try {
				uploadType = input.tag as UploadType
			} catch (e) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: 'Invalid upload tag',
				})
			}
			// console.log('VALID UPLOAD TAG')

			// check validity of passed key of new object
			const { valid, mime, ext } = await isKeyAllowed(input.key)
			// console.log('VALID KEY: ', { valid, mime })
			if (!valid)
				throw new trpc.TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: `invalid file extension. ${ext}`,
				})
			// console.log('VALID UPLOAD KEY')

			// Check if key is duplicate
			try {
				if (serverEnvs.AWS_S3_UPLOAD_BUCKET) {
					await s3
						.headObject({
							Bucket: serverEnvs.AWS_S3_UPLOAD_BUCKET,
							Key: input.key,
						})
						.promise()

					// console.log('DUPLICATE UPLOAD KEY')
					throw new TRPCError({ code: 'CONFLICT' })
				} else {
					// TODO: Add sentry alert
					// console.log('NO BUCKET!')
					throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' })
				}
			} catch (e) {
				if (e instanceof TRPCError && e.code === 'CONFLICT')
					throw new TRPCError({
						code: 'CONFLICT',
						message: 'This key already exists. Please select another key.',
					})
			}
			// console.log('UNIQUE UPLOAD KEY')

			// generate pre-signed URL to upload object
			try {
				if (!ctx.user?.sub && !ctx.sessionCookie?.sub) {
					throw new TRPCError({
						code: 'UNAUTHORIZED',
						message: 'You must be logged-in to upload files.',
					})
				}
				const userSub: string = (ctx.user?.sub || ctx.sessionCookie?.sub)! // guaranteed to exist

				const path = getStoragePath(userSub, uploadType, input.meta)
				if (path instanceof Error) {
					throw new TRPCError({
						code: 'INTERNAL_SERVER_ERROR',
						message: path.message,
					})
				}

				const url = await s3.getSignedUrlPromise('putObject', {
					Bucket: serverEnvs.AWS_S3_UPLOAD_BUCKET,
					Expires: 20 * 60,
					Key: path + input.key,
					ContentType: mime,
				})
				// TODO: Add entry on Assets table to track objects uploaded by user
				return { success: true, url, object: path + input.key }
			} catch (e) {
				throw new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: `Failed to generate upload url.${e.message}`,
				})
			}
		},
	})

export default utilsRouter
