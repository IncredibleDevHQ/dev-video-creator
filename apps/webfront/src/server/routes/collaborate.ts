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

/*
 * This is a helper method to abstract out the invitation logic.
 * Note: Call this function after all validations
 * @param ctx - The context object with prisma and user
 * @params input - The input object for the invitation
 * @returns The output object success:boolean
 */
const sendCollaborationInvite = async (
	ctx: Context,
	input: {
		flickId: string
		message: string
		receiverId: string
		senderId: string
	}
): Promise<{ success: boolean }> => {
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
				title: invitation.Flick ? invitation.Flick.name : 'New Story',
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
}

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
			const res = await sendCollaborationInvite(ctx, input)
			return res
		},
	})
	.mutation('emailInvite', {
		meta: {
			hasAuth: true,
		},
		input: z.object({
			flickId: z.string(),
			email: z.string(),
		}),
		resolve: async ({ ctx, input }) => {
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

			// check if user for given email already exists
			const user = await ctx.prisma.user.findUnique({
				where: {
					email: input.email,
				},
				select: {
					sub: true,
				},
			})
			// if found sendCollaborationInvite
			if (user && user.sub) {
				const res = await sendCollaborationInvite(ctx, {
					flickId: input.flickId,
					message: 'You have been invite to collaborate!',
					receiverId: user.sub,
					senderId: ctx.user!.sub,
				})
				return res
			}
			// else
			// create a new user
			const newUser = await ctx.prisma.user.create({
				data: {
					email: input.email,
					sub: input.email,
					username: input.email,
					branding: {},
					preferences: {},
				},
				select: {
					sub: true,
				},
			})
			// and then sendCollaborationInvite
			const res = await sendCollaborationInvite(ctx, {
				flickId: input.flickId,
				message: 'You have been invited to collaborate!',
				receiverId: newUser.sub,
				senderId: ctx.user!.sub,
			})

			return res
		},
	})

export default collaborateRouter
