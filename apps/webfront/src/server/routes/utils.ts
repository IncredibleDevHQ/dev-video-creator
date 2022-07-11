import * as trpc from '@trpc/server'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'

import { getStoragePath, UploadType } from 'src/utils/helpers/s3-path-builder'
import { s3 } from 'src/utils/aws'
import serverEnvs from 'src/utils/env'
import { Context } from '../createContext'
import { Meta } from '../utils/helpers'
import { isKeyAllowed } from '../utils/upload'

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
	/*
		MUTATIONS
	*/
	.mutation('getUploadUrl', {
		meta: {
			hasAuth: true,
		},
		input: z.object({
			key: z.string(),
			tag: z.nativeEnum(UploadType).nullish(),
			meta: z
				.object({
					flickId: z.string().nullable(),
					fragmentId: z.string().nullable(),
					brandId: z.string().nullable(),
					recordingId: z.string().nullable(),
				})
				.nullish(),
		}),
		output: z.object({
			success: z.boolean(),
			url: z.string(),
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
				const path = getStoragePath(ctx.user!.sub, uploadType, input.meta)
				const url = await s3.getSignedUrlPromise('putObject', {
					Bucket: serverEnvs.AWS_S3_UPLOAD_BUCKET,
					Expires: 20 * 60,
					Key: path + input.key,
					ContentType: mime,
				})
				// TODO: Add entry on Assets table to track objects uploaded by user
				return { success: true, url }
			} catch (e) {
				// console.log('Error generating pre-signed URL :', e)
				throw new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: 'Failed to generate upload url.',
				})
			}
		},
	})

export default utilsRouter
