import admin from 'firebase-admin'
import * as crypto from 'crypto'
import axios from 'axios'
import { createClient } from 'redis'
import { TRPCError } from '@trpc/server'
import serverEnvs from '../../utils/env'
import {
	sendTransactionalEmail,
	TransactionalMailType,
} from './transactionalEmail'

export interface Meta {
	hasAuth: boolean // can be used to disable auth for this specific routes
}

export enum FragmentTypeEnum {
	Landscape = 'Landscape',
	Portrait = 'Portrait',
	Presentation = 'Presentation',
}

export enum FlickScopeEnum {
	Public = 'Public',
	Private = 'Private',
}

export enum InvitationStatusEnum {
	Pending = 'Pending',
	Accepted = 'Accepted',
	Declined = 'Declined',
	Email = 'Email',
}

export enum NotificationTypeEnum {
	/** To communicate something async failed.  */
	Error = 'Error',
	/** Indicates some platform event , such as a flick is publish, blog is now live etc. */
	Event = 'Event',
	/** Indicates that the notification is either an invite or request to collaborate */
	Invitation = 'Invitation',
	/** Request */
	Request = 'Request',
}

export enum NotificationMetaTypeEnum {
	Flick = 'Flick',
	Follow = 'Follow',
	/** the meta will contains series details */
	Series = 'Series',
	/** the meta will contains user/profile details */
	User = 'User',
}

export enum ParticipantRoleEnum {
	Host = 'Host',
	Assistant = 'Assistant',
	Viewer = 'Viewer',
}

export const initFirebaseAdmin = () => {
	if (!admin.apps.length && serverEnvs.FIREBASE_SERVICE_CONFIG) {
		return admin.initializeApp({
			credential: admin.credential.cert(
				JSON.parse(serverEnvs.FIREBASE_SERVICE_CONFIG as string)
			),
		})
	}
	return admin
}

export const redisClient = createClient({
	socket: {
		host: serverEnvs.REDIS_ENDPOINT,
		port: Number(serverEnvs.REDIS_PORT),
	},
})

export function generateSuggestionsFromEmail(email: string): string[] {
	const suggestions = []

	for (let i = 0; i < 3; i += 1) {
		const nameParts = email.replace(/@.+/, '')
		const name = nameParts.replace(/[&/\\#,+()$~%._@'":*?<>{}]/g, '')
		suggestions.push(name + crypto.randomInt(100, 900).toString())
	}
	return suggestions
}

export const createLiveBlocksRoom = async (
	roomId: string,
	liveViewConfig: any,
	livePayload: any
) => {
	const liveblocksToken = await axios.post(
		`https://liveblocks.io/api/authorize`,
		{},
		{
			headers: {
				Authorization: `Bearer ${serverEnvs.LIVEBLOCKS_APIKEY}`,
			},
		}
	)
	await axios.post(
		`https://liveblocks.net/api/v1/room/${roomId}/storage`,
		{
			liveblocksType: 'LiveObject',
			data: {
				version: '2',
				viewConfig: {
					liveblocksType: 'LiveMap',
					data: liveViewConfig,
				},
				payload: {
					liveblocksType: 'LiveMap',
					data: livePayload,
				},
			},
		},
		{
			headers: {
				authorization: `Bearer ${liveblocksToken.data.token}`,
				'content-type': 'application/json',
			},
		}
	)
}

export const initRedisWithDataConfig = async (
	fragmentId: string,
	redisBody: any
): Promise<void> => {
	await redisClient.connect()
	redisClient.json
		.set(fragmentId, '$', redisBody)
		.then(() => console.log(`Stored on redis doc: ${fragmentId} `))
		.catch(e => {
			console.error(`Error storing on redis doc: ${fragmentId} error: ${e}`)
		})
		.finally(() => {
			redisClient.disconnect()
		})
}

export const sendInviteEmail = async (
	magicLinkState: string,
	receiver: {
		sub: string
		email: string | null
		displayName: string | null
		picture: string | null
	},
	sender: {
		sub: string
		email: string | null
		displayName: string | null
		picture: string | null
	},
	flick: {
		id: string
		name: string
	} | null,
	invite: {
		id: string
		notificationId: string
	}
) => {
	if (!flick?.id || !invite.id || !magicLinkState)
		throw new TRPCError({
			code: 'INTERNAL_SERVER_ERROR',
			message: 'Missing required parameters for invite email',
		})

	// TODO: move NEXT_API_BASE_URL handler to nextjs
	const emailPayload = {
		url:
			`${serverEnvs.NEXT_API_BASE_URL}/loginInvitedUser` +
			`?nid=${invite.notificationId}&state=${magicLinkState}&inviteId=${invite.id}&redirectURI=${serverEnvs.NEXT_STUDIO_BASE_URL}/story/${flick?.id}`,
	}

	if (!receiver.email)
		throw new TRPCError({
			code: 'INTERNAL_SERVER_ERROR',
			message: 'Could not send invitation email, receiver email not found',
		})

	await sendTransactionalEmail({
		mailType: TransactionalMailType.COLLABORATION,
		sendToEmail: receiver.email,
		messageData: {
			btnUrl: emailPayload.url,
			senderName: sender.displayName || sender.email || 'An Incredible Creator',
			storyTitle: flick?.name || 'New Story',
		},
	})
}
