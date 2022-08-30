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
import { z } from 'zod'
import { nanoid } from 'nanoid'
import {
	FlickScopeEnum,
	InvitationStatusEnum,
	NotificationMetaTypeEnum,
	NotificationTypeEnum,
	ParticipantRoleEnum,
} from 'utils/src/enums'
import serverEnvs from '../utils/env'
import { Context } from '../createContext'
import { Meta, sendInviteEmail } from '../utils/helpers'
import {
	sendTransactionalEmail,
	TransactionalMailType,
} from '../utils/transactionalEmail'
import { createFlick } from './story'

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
		flickId?: string
		message: string
		receiverId: string
		senderId: string
	}
): Promise<{ success: boolean }> => {
	if (!ctx.user?.sub) {
		throw new TRPCError({
			code: 'UNAUTHORIZED',
			message: 'Invalid Auth Token',
		})
	}

	// Create invitation
	const invitation = await ctx.prisma.invitations.create({
		data: {
			message: input.message,
			receiverId: input.receiverId,
			senderId: ctx.user.sub,
			status: InvitationStatusEnum.Pending.toString(),
			type: NotificationTypeEnum.Invitation,
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
	.query('getParticipants', {
		meta: {
			hasAuth: true,
		},
		input: z.object({
			id: z.string(),
		}),
		resolve: async ({ ctx, input }) => {
			const flickParticipants = await ctx.prisma.participant.findMany({
				where: {
					flickId: input.id,
				},
				select: {
					id: true,
					status: true,
					role: true,
					userSub: true,
					inviteStatus: true,
					User: {
						select: {
							displayName: true,
							picture: true,
							username: true,
							email: true,
							sub: true,
						},
					},
				},
				orderBy: {
					User: {
						displayName: 'asc',
					},
				},
			})
			return flickParticipants
		},
	})
	.query('pendingInvites', {
		meta: {
			hasAuth: true,
		},
		input: z.object({
			id: z.string(),
		}),
		resolve: async ({ ctx, input }) => {
			if (!ctx.user?.sub)
				throw new TRPCError({
					code: 'UNAUTHORIZED',
				})

			const invites = await ctx.prisma.invitations.findMany({
				where: {
					flickId: input.id,
					OR: [
						{
							status: InvitationStatusEnum.Pending.toString(),
						},
						{
							status: InvitationStatusEnum.Email.toString(),
						},
					],
				},
				select: {
					User_Invitations_receiverIdToUser: {
						select: {
							sub: true,
							email: true,
							displayName: true,
							picture: true,
						},
					},
				},
			})
			return invites
		},
	})
	// ACTIONS
	.mutation('invite', {
		meta: {
			hasAuth: true,
		},
		input: z.object({
			flickId: z.string().optional(),
			seriesId: z.string().optional(),
			title: z.string().optional().default('Untitled'),
			message: z.string(),
			receiverId: z.string(),
			senderId: z.string(),
			isNew: z.boolean().default(false),
		}),
		resolve: async ({ ctx, input }) => {
			if (input.senderId !== ctx.user!.sub) {
				throw new TRPCError({
					code: 'UNAUTHORIZED',
					message: 'Invalid invite request',
				})
			}

			// if isNew then first create a new flick and then invite
			if (input.isNew) {
				const newStory = await createFlick(ctx, {
					name: input.title,
					scope: FlickScopeEnum.Private,
					dirty: false,
					themeName: 'DarkGradient',
					useBranding: false,
					creationFlow: 'Notebook',
				})
				// eslint-disable-next-line no-param-reassign
				input.flickId = newStory.storyId

				// add to series if seriesId is passed
				if (input.seriesId) {
					await ctx.prisma.flick_Series.create({
						data: {
							flickId: newStory.storyId,
							seriesId: input.seriesId,
							order: 0,
						},
					})
				}
			}

			if (!input.flickId) {
				throw new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: 'Story is required',
				})
			}

			const flick = await ctx.prisma.flick.findUnique({
				where: {
					id: input.flickId,
				},
				select: {
					id: true,
					ownerSub: true,
					name: true,
					Participants: {
						select: {
							id: true,
							userSub: true,
							role: true,
						},
					},
				},
			})
			// Only story owner can invite a new user to a story
			if (flick?.ownerSub !== ctx.user!.sub) {
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
			if (!ctx.user?.sub)
				throw new TRPCError({
					code: 'UNAUTHORIZED',
					message: 'Unauthorized request.',
				})

			const flick = await ctx.prisma.flick.findUnique({
				where: {
					id: input.flickId,
				},
				select: {
					id: true,
					ownerSub: true,
					name: true,
					Participants: {
						select: {
							id: true,
							userSub: true,
							role: true,
						},
					},
				},
			})
			// Only story owner can invite a new user to a story
			const ownerParticipant = flick?.Participants.find(
				p => p.userSub === ctx.user!.sub
			)

			if (
				ownerParticipant?.role !== ParticipantRoleEnum.Host ||
				flick?.ownerSub !== ctx.user?.sub
			) {
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
					senderId: ctx.user.sub,
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
	.mutation('respond', {
		meta: { hasAuth: true },
		input: z.object({
			status: z.nativeEnum(InvitationStatusEnum),
			inviteId: z.string(),
			nid: z.string(),
		}),
		resolve: async ({ ctx, input }) => {
			if (!ctx.user?.sub) {
				throw new TRPCError({
					code: 'UNAUTHORIZED',
					message: 'Invalid Auth Token',
				})
			}
			// validate requestUser === invite receiver
			const invite = await ctx.prisma.invitations.findUnique({
				where: {
					id: input.inviteId,
				},
				select: {
					receiverId: true,
					senderId: true,
					Flick: {
						select: {
							name: true,
							id: true,
						},
					},
					User_Invitations_senderIdToUser: {
						select: {
							displayName: true,
							email: true,
						},
					},
					User_Invitations_receiverIdToUser: {
						select: {
							displayName: true,
						},
					},
				},
			})

			if (invite?.receiverId !== ctx.user!.sub) {
				throw new TRPCError({
					code: 'UNAUTHORIZED',
					message: 'Invalid invite request',
				})
			}
			// If declined
			if (input.status === InvitationStatusEnum.Declined) {
				// update invite status
				await ctx.prisma.invitations.update({
					where: {
						id: input.inviteId,
					},
					data: {
						status: InvitationStatusEnum.Declined,
					},
				})
				// delete notification
				await ctx.prisma.notifications.delete({
					where: {
						id: input.nid,
					},
				})
			} else {
				// If Accepted
				if (!invite?.Flick?.id) {
					throw new TRPCError({
						code: 'INTERNAL_SERVER_ERROR',
						message: 'Story for this invite could not be found',
					})
				}

				// accept invitation
				await ctx.prisma.invitations.update({
					where: {
						id: input.inviteId,
					},
					data: {
						status: InvitationStatusEnum.Accepted,
						updated_at: new Date(),
					},
				})

				// add user as participants
				await ctx.prisma.participant.create({
					data: {
						userSub: ctx.user!.sub,
						flickId: invite.Flick.id,
						role: ParticipantRoleEnum.Assistant,
						inviteStatus: InvitationStatusEnum.Accepted,
					},
				})

				// update notification that invitation was accepted for the receiver
				await ctx.prisma.notifications.update({
					where: {
						id: input.nid,
					},
					data: {
						message: `You have been added to %${
							invite.Flick?.name || 'An Incredible Story'
						}%. Join %${
							invite.User_Invitations_senderIdToUser.displayName
						}% in creating amazing content!`,
						type: NotificationTypeEnum.Event,
						metaType: NotificationMetaTypeEnum.Flick,
						meta: {
							flickId: invite.Flick?.id,
						},
					},
				})

				// add new notification to inform notification-sender that req was accepted
				await ctx.prisma.notifications.create({
					data: {
						senderId: invite.receiverId,
						receiverId: invite.senderId,
						message: `Your collaboration request for %${invite.Flick?.name}% has been accepted by %${invite.User_Invitations_receiverIdToUser.displayName}%!`,
						metaType: NotificationMetaTypeEnum.Flick,
						meta: {
							flickId: invite.Flick?.id,
						},
						type: NotificationTypeEnum.Event,
					},
				})

				// also send email to invite-sender that the receiver is now collaborating
				if (invite.User_Invitations_senderIdToUser.email && invite.Flick?.id)
					await sendTransactionalEmail({
						mailType: TransactionalMailType.COLLABORATION_ACCEPTED,
						sendToEmail: invite.User_Invitations_senderIdToUser.email,
						messageData: {
							btnUrl: `${serverEnvs.NEXT_STUDIO_BASE_URL}/story/${invite.Flick.id}`,
							storyTitle: invite.Flick.name,
							receiverName:
								invite.User_Invitations_receiverIdToUser.displayName ||
								'Incredible Creator',
						},
					})
			}
			return {
				success: true,
			}
		},
	})
	// TODO: we may need delete invite feature
	.mutation('removeParticipant', {
		meta: { hasAuth: true },
		input: z.object({
			flickId: z.string(),
			userSubToRemove: z.string(),
		}),
		resolve: async ({ ctx, input }) => {
			const flick = await ctx.prisma.flick.findUnique({
				where: {
					id: input.flickId,
				},
				select: {
					id: true,
					ownerSub: true,
					Participants: {
						select: {
							id: true,
							userSub: true,
							role: true,
						},
					},
				},
			})
			// Only story owner can remove a user from a story
			const ownerParticipant = flick?.Participants.find(
				p => p.userSub === ctx.user!.sub
			)
			if (
				ownerParticipant?.role !== ParticipantRoleEnum.Host ||
				flick?.ownerSub !== ctx.user!.sub
			) {
				throw new TRPCError({
					code: 'UNAUTHORIZED',
					message: 'Unauthorized, only the story owner can remove members.',
				})
			}
			// delete participant
			await ctx.prisma.participant.deleteMany({
				where: {
					userSub: input.userSubToRemove,
				},
			})
			// delete invites for this removed user
			await ctx.prisma.invitations.deleteMany({
				where: {
					flickId: input.flickId,
					receiverId: input.userSubToRemove,
				},
			})
			return {
				success: true,
			}
		},
	})
	.mutation('transferOwnership', {
		meta: { hasAuth: true },
		input: z.object({
			flickId: z.string(),
			newOwnerParticipantId: z.string(),
		}),
		resolve: async ({ ctx, input }) => {
			// get flick details
			const flick = await ctx.prisma.flick.findUnique({
				where: {
					id: input.flickId,
				},
				select: {
					id: true,
					ownerSub: true,
					Participants: {
						select: {
							id: true,
							userSub: true,
							role: true,
						},
					},
				},
			})
			if (!flick || !flick.id)
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: 'Story not found',
				})

			// check if requester is flick owner
			const ownerParticipant = flick?.Participants.find(
				p => p.userSub === ctx.user!.sub
			)
			if (
				ownerParticipant?.role !== ParticipantRoleEnum.Host ||
				flick?.ownerSub !== ctx.user!.sub
			) {
				throw new TRPCError({
					code: 'UNAUTHORIZED',
					message: 'Unauthorized, only the story owner can transfer ownership.',
				})
			}

			// check if new owner is a participant of the story
			const newOwnerParticipant = flick?.Participants.find(
				p => p.id === input.newOwnerParticipantId
			)
			if (!newOwnerParticipant) {
				throw new TRPCError({
					code: 'UNAUTHORIZED',
					message:
						'Unauthorized, the new owner is not a participant of the story.First add the user to the story before transferring ownership.',
				})
			}

			// change ownerSub on Flick table
			const res = await ctx.prisma.flick.update({
				where: {
					id: input.flickId,
				},
				data: {
					ownerSub: newOwnerParticipant.userSub,
				},
				select: {
					id: true,
					ownerSub: true,
				},
			})

			// update Participant table
			// make new owner as host
			await ctx.prisma.participant.update({
				where: {
					id: input.newOwnerParticipantId,
				},
				data: {
					role: ParticipantRoleEnum.Host,
				},
			})
			// make old owner as assistant participant
			await ctx.prisma.participant.update({
				where: {
					id: ownerParticipant.id,
				},
				data: {
					role: ParticipantRoleEnum.Assistant,
				},
			})

			return res
		},
	})
export default collaborateRouter
