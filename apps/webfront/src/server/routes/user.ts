/* eslint-disable no-underscore-dangle */
import * as trpc from '@trpc/server'
import { TRPCError } from '@trpc/server'
import { NotificationTypeEnum } from 'src/utils/enums'

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
	// ACTION'S
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
	.query('profile', {
		meta: {
			hasAuth: false,
		},
		input: z.object({
			username: z.string(),
		}),
		resolve: async ({ input, ctx }) => {
			const stories = await ctx.prisma.flick.findMany({
				where: {
					Participants: {
						some: {
							User: {
								username: input.username,
							},
						},
					},
				},
				orderBy: {
					updatedAt: 'desc',
				},
				select: {
					description: true,
					joinLink: true,
					lobbyPicture: true,
					id: true,
					name: true,
					scope: true,
					md: true,
					dirty: true,
					publishedAt: true,
					ownerSub: true,
					Owner: {
						select: {
							sub: true,
						},
					},
					updatedAt: true,
					thumbnail: true,
					status: true,
					deletedAt: true,
					producedLink: true,
					configuration: true,
					Content: {
						select: {
							id: true,
							data: true,
							published_at: true,
							isPublic: true,
							seriesId: true,
							resource: true,
							preview: true,
							thumbnail: true,
							type: true,
						},
					},
					topicTags: true,
					Participants: {
						select: {
							id: true,
							role: true,
							User: {
								select: {
									sub: true,
									displayName: true,
									picture: true,
									username: true,
								},
							},
						},
					},
				},
			})
			const user = await ctx.prisma.user.findUnique({
				where: {
					username: input.username,
				},
				select: {
					sub: true,
					username: true,
					displayName: true,
					picture: true,
					Profile: {
						select: {
							id: true,
							title: true,
							about: true,
							coverImage: true,
							githubProfile: true,
							hashnodeProfile: true,
							linkedinProfile: true,
							mediumProfile: true,
							twitterProfile: true,
							tags: true,
						},
					},
					Series: {
						select: {
							id: true,
							name: true,
							description: true,
							picture: true,
							createdAt: true,
							updatedAt: true,
							User: {
								select: {
									sub: true,
									displayName: true,
									picture: true,
									username: true,
								},
							},
							Flick_Series: {
								select: {
									Flick: {
										select: {
											id: true,
											status: true,
											name: true,
											description: true,
											thumbnail: true,
											configuration: true,
											ownerSub: true,
											joinLink: true,
											topicTags: true,
											Content: {
												select: {
													id: true,
													isPublic: true,
													type: true,
													resource: true,
													thumbnail: true,
													published_at: true,
												},
											},
											Participants: {
												select: {
													id: true,
													role: true,
													User: {
														select: {
															sub: true,
															picture: true,
															username: true,
															displayName: true,
														},
													},
												},
											},
										},
									},
								},
							},
						},
						orderBy: {
							updatedAt: 'desc',
						},
					},
				},
			})
			if (!user || !user.Series) {
				throw new TRPCError({
					code: 'NOT_FOUND',
				})
			}
			return {
				user,
				series: user.Series,
				stories,
			}
		},
	})
	.query('availability', {
		meta: {
			hasAuth: true,
		},
		input: z.object({
			username: z.string(),
			senderEmail: z.string().optional(),
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

			let suggestion = null
			if (input.senderEmail)
				suggestion = generateSuggestionsFromEmail(input.senderEmail)

			return {
				valid: false,
				message: 'Username is not available',
				suggestion,
			}
		},
	})
	.query('isFollowing', {
		meta: {
			hasAuth: true,
		},
		input: z.object({
			followerId: z.string(),
			targetId: z.string(),
		}),
		resolve: async ({ input, ctx }) => {
			const follower = await ctx.prisma.follow.findUnique({
				where: {
					targetId_followerId: {
						followerId: input.followerId,
						targetId: input.targetId,
					},
				},
				select: {
					followerId: true,
				},
			})
			if (follower?.followerId) {
				return {
					isFollowing: true,
				}
			}
			return {
				isFollowing: false,
			}
		},
	})
	.query('notifications', {
		meta: {
			hasAuth: true,
		},
		input: z
			.object({
				limit: z.number().optional().default(15),
				offset: z.number().optional().default(0),
			})
			.optional(),
		resolve: async ({ input, ctx }) => {
			if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' })
			const notifications = await ctx.prisma.notifications.findMany({
				where: {
					receiverId: ctx.user.sub,
				},
				select: {
					id: true,
					type: true,
					isRead: true,
					createdAt: true,
					message: true,
					meta: true,
					metaType: true,
					User_Notifications_senderIdToUser: {
						select: {
							sub: true,
							picture: true,
							displayName: true,
							username: true,
						},
					},
				},
				orderBy: {
					createdAt: 'desc',
				},
				take: input?.limit || 15,
				skip: input?.offset || 0,
			})
			return notifications
		},
	})
	.query('notificationsCount', {
		meta: {
			hasAuth: true,
		},
		resolve: async ({ ctx }) => {
			if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' })
			const count = await ctx.prisma.notifications.count({
				where: {
					receiverId: ctx.user.sub,
					isRead: false,
				},
			})
			return { count }
		},
	})
	.query('brands', {
		meta: { hasAuth: true },
		resolve: async ({ ctx }) => {
			if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' })
			const brands = await ctx.prisma.branding.findMany({
				where: {
					userSub: ctx.user.sub,
				},
				select: {
					id: true,
					name: true,
					branding: true,
				},
			})
			return brands
		},
	})
	// Data Queries
	/*
		MUTATIONS
	*/
	// ACTION'S
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
	.mutation('checkFollows', {
		meta: {
			hasAuth: true,
		},
		input: z.object({
			followerId: z.string(),
			targetIds: z.array(z.string()).min(1),
		}),
		resolve: async ({ input, ctx }) => {
			const follows = await ctx.prisma.follow.findMany({
				where: {
					targetId: {
						in: input.targetIds,
					},
					followerId: input.followerId,
				},
				select: {
					targetId: true,
				},
			})
			return follows
		},
	})
	.mutation('follow', {
		meta: {
			hasAuth: true,
		},
		input: z.object({
			followerId: z.string(),
			targetId: z.string(),
		}),
		resolve: async ({ input, ctx }) => {
			if (!ctx.user?.sub)
				throw new TRPCError({
					code: 'UNAUTHORIZED',
				})
			const follow = await ctx.prisma.follow.create({
				data: {
					followerId: ctx.user.sub,
					targetId: input.targetId,
					created_at: new Date(),
				},
				select: {
					followerId: true,
					User_Follow_followerIdToUser: {
						select: {
							displayName: true,
						},
					},
				},
			})
			if (!follow.followerId)
				return {
					success: false,
				}
			// add notification
			await ctx.prisma.notifications.create({
				data: {
					senderId: ctx.user.sub,
					receiverId: input.targetId,
					message: ` %${follow?.User_Follow_followerIdToUser.displayName}% has started following you.`,
					type: NotificationTypeEnum.Event,
				},
			})

			return {
				success: true,
			}
		},
	})
	.mutation('unfollow', {
		meta: {
			hasAuth: true,
		},
		input: z.object({
			followerId: z.string(),
			targetId: z.string(),
		}),
		resolve: async ({ input, ctx }) => {
			if (!ctx.user?.sub)
				throw new TRPCError({
					code: 'UNAUTHORIZED',
				})

			const unfollow = await ctx.prisma.follow.delete({
				where: {
					targetId_followerId: {
						followerId: ctx.user.sub,
						targetId: input.targetId,
					},
				},
			})

			if (!unfollow.targetId) return { success: false }

			return { success: true }
		},
	})
	.mutation('readNotification', {
		meta: {
			hasAuth: true,
		},
		input: z.object({ id: z.string() }),
		resolve: async ({ input, ctx }) => {
			if (!ctx.user?.sub)
				throw new TRPCError({
					code: 'UNAUTHORIZED',
				})
			const notification = await ctx.prisma.notifications.update({
				where: {
					id: input.id,
				},
				data: {
					isRead: true,
				},
			})
			if (!notification) return { success: false }
			return { success: true }
		},
	})
	.mutation('readlAllNotifications', {
		meta: {
			hasAuth: true,
		},
		resolve: async ({ ctx }) => {
			if (!ctx.user?.sub)
				throw new TRPCError({
					code: 'UNAUTHORIZED',
				})
			const notifications = await ctx.prisma.notifications.updateMany({
				where: {
					receiverId: ctx.user.sub,
				},
				data: {
					isRead: true,
				},
			})
			if (!notifications) return { success: false }
			return { success: true }
		},
	})

export default userRouter
