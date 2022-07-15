import { TRPCError } from '@trpc/server'
import * as trpc from '@trpc/server'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import { Context } from '../createContext'
import {
	InvitationStatusEnum,
	Meta,
	NotificationMetaTypeEnum,
	sendInviteEmail,
} from '../utils/helpers'

const collaborateRouter = trpc
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
	.mutation('invite', {
		meta: {
			hasAuth: true,
		},
		input: z.object({
			flickId: z.string(),
			message: z.string(),
			receiverId: z.string(),
			senderId: z.string(),
		}),
		resolve: async ({ ctx, input }) => {
			if (input.senderId !== ctx.user!.sub) {
				throw new TRPCError({
					code: 'UNAUTHORIZED',
					message: 'Invalid invite request',
				})
			}
			const flick = await ctx.prisma.flick.findUnique({
				where: {
					id: input.flickId,
				},
				select: {
					id: true,
					ownerId: true,
					name: true,
					Participants: {
						select: {
							id: true,
							userSub: true,
						},
					},
				},
			})
			// Only story owner can invite a new user to a story
			const ownerParticipant = flick?.Participants.find(
				p => p.userSub === ctx.user!.sub
			)
			if (!ownerParticipant || flick?.ownerId !== ownerParticipant.id) {
				throw new TRPCError({
					code: 'UNAUTHORIZED',
					message: 'Unauthorized, only the story owner can invite new members.',
				})
			}

			// Check if the user is already a member of the story
			if (flick?.Participants.find(p => p.userSub === input.receiverId)) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: 'User is already a member of the story.',
				})
			}

			// Create invitation
			const invitation = await ctx.prisma.invitations.create({
				data: {
					message: input.message,
					receiverId: input.receiverId,
					senderId: ctx.user!.sub,
					status: InvitationStatusEnum.Pending,
					type: 'Invite',
					flickId: input.flickId,
				},
				select: {
					id: true,
					User_Invitations_receiverIdToUser: {
						select: {
							sub: true,
							email: true,
							displayName: true,
							picture: true,
						},
					},
					User_Invitations_senderIdToUser: {
						select: {
							sub: true,
							email: true,
							displayName: true,
							picture: true,
						},
					},
					Flick: {
						select: {
							id: true,
							name: true,
						},
					},
				},
			})

			// send notification
			const notify = await ctx.prisma.notifications.create({
				data: {
					message: input.message,
					receiverId: input.receiverId,
					senderId: ctx.user!.sub,
					type: 'Invite',
					meta: {
						inviteId: invitation.id,
						flickId: input.flickId,
						title: flick.name,
					},
					metaType: NotificationMetaTypeEnum.Flick,
				},
				select: {
					id: true,
				},
			})

			// For Invites, send out an email to the receiver with the invite link which automatically accepts
			// the invite and redirects to the notebook
			// add email user to magic link table with a state
			const inviteMagicLinkState = nanoid()
			const magicLink = await ctx.prisma.magicLink.create({
				data: {
					userSub: invitation.User_Invitations_receiverIdToUser.sub,
					state: inviteMagicLinkState,
				},
				select: {
					state: true,
				},
			})
			if (magicLink.state)
				await sendInviteEmail(
					magicLink.state,
					invitation.User_Invitations_receiverIdToUser,
					invitation.User_Invitations_senderIdToUser,
					invitation.Flick,
					{
						id: invitation.id,
						notificationId: notify.id,
					}
				)
			return {
				success: true,
			}
		},
	})

export default collaborateRouter
