import admin from 'firebase-admin'
import * as crypto from 'crypto'
import axios from 'axios'
import { createClient } from 'redis'
import { TRPCError } from '@trpc/server'
import { PrismaClient } from '@prisma/client'
import Mux from '@mux/mux-node'
import { s3 } from 'src/utils/aws'
import * as Y from 'yjs'
import { TiptapTransformer } from '@hocuspocus/transformer'
import Paragraph from '@tiptap/extension-paragraph'
import Document from '@tiptap/extension-document'
import Text from '@tiptap/extension-text'
// eslint-disable-next-line import/no-extraneous-dependencies
import * as uuid from 'uuid'
import VideoBlock from './VideoBlock'
import serverEnvs from '../../utils/env'
import {
	sendTransactionalEmail,
	TransactionalMailType,
} from './transactionalEmail'

// Delete on mux
const { Video: MuxVideo } = new Mux(
	serverEnvs.MUX_TOKEN_ID, // config.services.mux.tokenId,
	serverEnvs.MUX_TOKEN_SECRET, // config.services.mux.tokenSecret,
	{}
)

export const defaultDataConfig = {
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

export const getDefaultViewConfig = (
	introBlockId: string,
	outroBlockId: string,
	ownerParticipant: any
) => {
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
	return {
		selectedBlocks: [],
		continuousRecording: false,
		mode: 'Landscape',
		speakers: [ownerParticipant],
		blocks,
	}
}

export interface Meta {
	hasAuth: boolean // can be used to disable auth for this specific routes
}

export interface EditorState {
	blocks?: BlocksEntity[]
}

export interface BlocksEntity {
	pos: number
	introBlock?: any | null
	id: string
	type: string
	listBlock?: any | null
	nodeIds?: (string | null)[] | null
	imageBlock?: any | null
	videoBlock?: any | null
	codeBlock?: any | null
	headingBlock?: any | null
	interactionBlock?: any | null
	ts: Date
	url: string
}
export interface CallToAction {
	seconds: number
	text?: string
	url?: string
}

export interface BlockParticipant {
	username?: string
	displayName?: string
	picture?: string
}

export interface BlockMeta {
	id: string
	playbackDuration: number
	thumbnail?: string
	title: string
	type: string
	participants: BlockParticipant[]
	code: string | undefined
	interactionUrl: string | undefined
	interactionType: string | undefined
}

export interface IPublish {
	title?: string
	description?: string
	thumbnail?: {
		objectId?: string
		method?: 'generated' | 'uploaded'
	}
	ctas: CallToAction[]
	blocks: BlockMeta[]
	discordCTA?: { url: string; text: string }
}

export interface MuxMetaPassThrough {
	contentId: string
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

export const redisClient =
	serverEnvs.NODE_ENV === 'development'
		? createClient({
				socket: { host: '127.0.0.1', port: 6379 },
		  })
		: createClient({
				socket: {
					host: serverEnvs.REDIS_ENDPOINT,
					port: Number(serverEnvs.REDIS_PORT),
				},
		  })

export const validateEmail = (email: string) => {
	const re =
		/^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
	return re.test(String(email).toLowerCase())
}

export function generateSuggestionsFromEmail(email: string): string {
	const nameParts = email.replace(/@.+/, '')
	const name = nameParts.replace(/[&/\\#,+()$~%._@'":*?<>{}]/g, '')
	const suggestion = name + crypto.randomInt(100, 900).toString()

	return suggestion
}

export const createLiveBlocksRoom = async (
	storyId: string,
	fragmentId: string,
	fragmentViewConfig: any,
	introBlockId: string,
	outroBlockId: string
) => {
	// re-srctructure the view config for liveblocks
	const roomId = `story-${storyId}`
	const liveViewConfig: any = {}
	liveViewConfig[fragmentId] = {
		liveblocksType: 'LiveObject',
		data: {
			...fragmentViewConfig,
			blocks: {
				liveblocksType: 'LiveMap',
				data: fragmentViewConfig.blocks,
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
	console.log('Starting liveblocks Initialization .... ')

	const liveblocksToken = await axios.post(
		`https://liveblocks.io/api/authorize`,
		{},
		{
			headers: {
				Authorization: `Bearer ${serverEnvs.LIVEBLOCKS_API_KEY}`,
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
					data: payload,
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
	console.log('Completed liveblocks Initialization')
}

export const initRedisWithDataConfig = async (
	fragmentId: string,
	fragmentDataConfig: any,
	fragmentEncodedEditorValue: any
): Promise<void> => {
	console.log('Init redis for yjs....')
	// Init yjs binary layer
	let raw
	let redisBody: any = {
		ast: fragmentDataConfig,
	}
	if (fragmentEncodedEditorValue) {
		console.log('creating buffer for yjs...')
		const yDoc = TiptapTransformer.extensions([
			VideoBlock,
			Document,
			Text,
			Paragraph,
		]).toYdoc(
			JSON.parse(
				Buffer.from(fragmentEncodedEditorValue, 'base64').toString('utf8')
			)
		)
		const state = Buffer.from(Y.encodeStateAsUpdate(yDoc))
		raw = Buffer.from(state).toString('binary')
		redisBody = {
			...redisBody,
			raw,
		}
		console.log('buffer for yjs is ready.')
	}
	console.log('Connecting to redis on ', serverEnvs.NODE_ENV, '...')
	await redisClient.connect()
	console.log('Connected to Redis')
	redisClient.json
		.set(fragmentId, '$', redisBody)
		.then(() => console.log(`Stored on redis doc: ${fragmentId} `))
		.catch(e => {
			console.error(`Error storing on redis doc: ${fragmentId} error: ${e}`)
		})
		.finally(() => {
			redisClient.disconnect()
		})
	console.log('Completed redis init for yjs')
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

export const getBlockTitle = (block: BlocksEntity): string => {
	switch (block.type) {
		case 'introBlock':
			return 'Intro'
		case 'codeBlock':
			return (
				block.codeBlock.title || block.codeBlock.fallbackTitle || 'Code Block'
			)
		case 'listBlock':
			return (
				block.listBlock.title || block.listBlock.fallbackTitle || 'List Block'
			)
		case 'imageBlock':
			return (
				block.imageBlock.title ||
				block.imageBlock.fallbackTitle ||
				'Image Block'
			)
		case 'videoBlock':
			return (
				block.videoBlock.title ||
				block.videoBlock.fallbackTitle ||
				'Video Block'
			)
		case 'headingBlock':
			return block.headingBlock.title || 'Heading Block'
		case 'outroBlock':
			return 'Outro'

		case 'interactionBlock':
			return (
				block.interactionBlock.title ||
				block.interactionBlock.fallbackTitle ||
				'Interaction Block'
			)

		default:
			return 'Block'
	}
}

/*
  We dont throw an exception for delete currently because current flow will try to delete non-existing asset which was
  created b4 mux migration.
*/
export const DeleteMuxAsset = async (
	contentId: string,
	prisma: PrismaClient
) => {
	console.log(`Deleting Mux Asset for contentId ${contentId}`)
	// Mark as delete on MuxTracking table on DB
	const muxDel = await prisma.mux_Assets.delete({
		where: {
			contentId,
		},
		select: {
			muxAssetId: true,
		},
	})
	if (!muxDel) {
		console.log('Failed to mark Mux Asset as deleted on psql tracker table')
		// Sentry.captureException(
		// 	'Error Deleting mux asset:' + muxDel.errors[0].message
		// )
		return
	}

	const res = await MuxVideo.Assets.del(muxDel.muxAssetId)
	if (!res) {
		console.log('Error deleting video on Mux : ', JSON.stringify(res.data))
		// Sentry.captureException(
		// 	new Error('cid: ' + contentId + 'Error deleting video on Mux')
		// )
		// throw new Error("Mux error: " + JSON.stringify(res.data));
	}
	console.log('DeleteMuxAsset completed with res : ', res)
}

export const AddVideoToMux = async (
	objectKey: string,
	passThrough: MuxMetaPassThrough
) => {
	// get pre-signed url for the object to send to mux
	const presignedUrl = s3.getSignedUrl('getObject', {
		Bucket: serverEnvs.AWS_S3_UPLOAD_BUCKET,
		Key: objectKey,
		Expires: 300, // in seconds
	})
	const res = await MuxVideo.Assets.create({
		input: presignedUrl,
		playback_policy: 'public',
		passthrough: JSON.stringify(passThrough), // NOTE: mux has a character limit on this - Max: 255 characters.
		test: false, // config.env === "development" ? true : false,
	})
	if (!res) {
		console.log('Error adding video to Mux')
		throw new Error('Mux error')
	}
	return res
}

export const CreateMuxAsset = async (
	prisma: PrismaClient,
	objectKey: string,
	contentId: string
) => {
	console.log('Creating mux asset for content Id ', contentId)
	// Add video to mux for streaming
	const muxAsset = await AddVideoToMux(objectKey, { contentId })

	if (!muxAsset) {
		throw new Error('Failed to add video to mux')
	}

	if (
		!muxAsset.playback_ids ||
		muxAsset.playback_ids.length < 1 ||
		!muxAsset.playback_ids[0].id ||
		!muxAsset.playback_ids[0].policy
	) {
		throw new Error(
			`Invalid playback id in muxAsset: ${JSON.stringify(muxAsset)}`
		)
	}

	// track mux asset on postgres
	await prisma.mux_Assets.create({
		data: {
			muxAssetId: muxAsset.id,
			muxPlaybackId: muxAsset.playback_ids[0].id,
			muxPlaybackPolicy: muxAsset.playback_ids[0].policy,
			muxAssetStatus: muxAsset.status,
			s3Object: objectKey,
			contentId,
		},
	})

	return muxAsset.playback_ids[0]
}

/**
 * Generate magic sign-in with email link using Firebase.
 * @async
 * @function
 * @param {string} email - email id of the user.
 * @param {string} continueUrl - url to redirect the user with the action code as query parameter.
 * @return {Promise} Magic link to sign-in the user.
 * @example
 * // returns "https://incredibledev-next.firebaseapp.com/__/auth/action?continueUrl=..."
 * await getEmailSignInLink({email:"johndoe@incredible.dev",continueUrl:"https://dev.incredible.dev/magiclink?state=3-2_1OMt4j-lecHS3ro7d"});
 *
 */
export const getEmailSignInLink = async (
	email: string,
	continueUrl: string
): Promise<string> => {
	// create action code setting for email verification link
	const actionCodeSettings = {
		url: continueUrl,
		// This must be true for email link sign-in
		handleCodeInApp: true,
		// FDL custom domain
		dynamicLinkDomain: serverEnvs.SECURITY_DYN_LINK_DOMAIN,
	}
	const res = await admin
		.auth()
		.generateSignInWithEmailLink(email, actionCodeSettings)
	return res
}
