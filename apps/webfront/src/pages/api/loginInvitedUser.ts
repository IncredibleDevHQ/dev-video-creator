import { NextApiRequest, NextApiResponse } from 'next'

import { getEmailSignInLink } from 'server/utils/helpers'
import {
	InvitationStatusEnum,
	NotificationMetaTypeEnum,
	NotificationTypeEnum,
	ParticipantRoleEnum,
} from 'src/utils/enums'
import serverEnvs from 'server/utils/env'
import prisma from 'prisma-orm/prisma'

export const loginInvitedUser = async (
	req: NextApiRequest,
	res: NextApiResponse
) => {
	try {
		const invitedEmailState = req.query.state as string
		// url to which the logged in guest user will be redirected to
		const redirectURI = req.query.redirectURI as string
		const inviteId = req.query.inviteId as string
		const notificationId = req.query.nid as string

		// console.log('Get email id from invited email state : ', invitedEmailState)
		// console.log('Redirect invited user to : ', redirectURI)

		// create prisma client

		// Check if user is already a idev user
		// here we dont use `fetchEmailUsingState` action as it needs
		// to be used only by the client to login the user and it performs `incrementMagicLinkUsageCount`
		// which is not desireable when we are trying to dynamically login-redirect user as in this case.
		// Entry to the magic link table with a state is done when an email invite is sent to the user.
		const userData = await prisma.magicLink.findUnique({
			where: {
				state: invitedEmailState,
			},
			select: {
				usageCount: true,
				User: {
					select: {
						sub: true,
						email: true,
					},
				},
			},
		})

		if (!userData) {
			throw new Error('Invalid Invite')
		}

		// If the client has already used the magiclink to login , dis-allow this flow
		// Reusing this link to login will add duplicate participants to the flick the email-user was invited to.
		if (userData.usageCount > 0) {
			throw new Error('This invite has already been accepted!')
		}

		const user = userData.User

		// user not found
		if (!user) {
			// Assumption: The invited user , if invited with just email,i.e: he is a non idev user,
			// will be created as a guest user when the invite email is sent, with email as sub.
			// Hence if we are unable to lookup the user in this step , invite has error'd out.
			// Ref: Invite with email action.
			throw Error('Something went wrong!')
		}

		// reval condition, seems un-necessary
		if (!user.email) {
			throw Error('Something went wrong!!')
		}

		// use email and tracking state to generate a magic link
		const url = await getEmailSignInLink(
			user.email,
			// TODO: need magiclink route on client to handle this
			`${serverEnvs.NEXT_PUBLIC_BASE_URL}/magiclink?state=${invitedEmailState}&redirectURI=${redirectURI}`
		)

		// update invitation table
		const inviteData = await prisma.invitations.findUnique({
			where: {
				id: inviteId,
			},
			select: {
				Flick: {
					select: {
						name: true,
					},
				},
				flickId: true,
				senderId: true,
				receiverId: true,
			},
		})

		if (!inviteData || !inviteData.flickId) {
			throw new Error('Invalid Invitation!')
		}

		const inviteUpdate = await prisma.invitations.update({
			where: {
				id: inviteId,
			},
			data: {
				status: InvitationStatusEnum.Accepted,
				updated_at: new Date(),
			},
			select: {
				receiverId: true,
				senderId: true,
				type: true,
				Flick: {
					select: {
						id: true,
						name: true,
					},
				},
				Series: {
					select: {
						id: true,
						name: true,
					},
				},
				User_Invitations_senderIdToUser: {
					select: {
						sub: true,
						displayName: true,
						email: true,
					},
				},
				User_Invitations_receiverIdToUser: {
					select: {
						sub: true,
						displayName: true,
						email: true,
					},
				},
			},
		})

		if (!inviteUpdate) {
			console.log('ERROR: Could not accept this invitation!')
			throw new Error('Something went wrong ;(')
		}

		// add user to flick participants
		const participantData = await prisma.participant.create({
			data: {
				flickId: inviteData.flickId,
				userSub: user.sub,
				role: ParticipantRoleEnum.Assistant,
				inviteStatus: InvitationStatusEnum.Accepted,
			},
			select: {
				id: true,
			},
		})
		if (!participantData) {
			console.log(
				'Something went wrong when we tried to add you to the flick.',
				participantData
			)
			throw new Error('Something went wrong :(')
		}

		// update notification table
		const notificationData = await prisma.notifications.update({
			where: {
				id: notificationId,
			},
			data: {
				meta: {
					inviteId,
					flickId: inviteData.flickId,
				},
				metaType: NotificationMetaTypeEnum.Flick,
				type: NotificationTypeEnum.Event,
				isRead: false,
			},
			select: {
				id: true,
			},
		})

		if (!notificationData) {
			console.log('ERROR: Something went wrong while updating notification')
		}
		console.log('Email user successfully added to incredible!')

		// segment tracking
		// check if user is already a idev user , if not track on segment
		const isIdev = await prisma.user.findUnique({
			where: {
				email: user.email,
			},
			select: {
				sub: true,
				displayName: true,
				picture: true,
				email: true,
				username: true,
				verified: true,
			},
		})

		if (isIdev && isIdev.sub && inviteData.senderId) {
			// track refer's on DB
			const referredBy = await prisma.user.update({
				where: {
					sub: user.sub,
				},
				data: {
					referred_by: inviteData.senderId,
				},
				select: {
					sub: true,
				},
			})
			if (!referredBy || !referredBy.sub) {
				// Non-fatal error
				// Sentry.captureException(new Error(referredBy.errors[0].message))
				console.log('Error:Couldnt update referedBy for user: ', user.sub)
			}

			// segment.identify({
			// 	userId: user.email,
			// 	traits: {
			// 		sub: user.sub,
			// 		email: user.email,
			// 	},
			// })

			// track on segment
			// segment.track({
			// 	event: 'Collaboration Signup',
			// 	userId: user.email,
			// 	properties: {
			// 		source: 'Email Accept',
			// 		inviteId,
			// 		referredBy:
			// 			referredBy.data?.update_User?.returning[0]?.Referral?.email,
			// 	},
			// })
		}
		return res.status(301).redirect(url)
	} catch (e) {
		console.log(e)
		// Sentry.captureException(e)
		// res.status(400).json({ message: (e as Error).message, code: "ERR_INVTD_USER_LOGIN" });

		return res
			.status(301)
			.redirect(
				`${serverEnvs.NEXT_PUBLIC_BASE_URL}/magiclink?error=${
					(e as Error).message
				}`
			)
	}
}

export default loginInvitedUser
