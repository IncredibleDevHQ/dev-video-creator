import admin from 'firebase-admin'
import * as crypto from 'crypto'
import axios from 'axios'
import { createClient } from 'redis'
import serverEnvs from '../../utils/env'

export interface Meta {
	hasAuth: boolean // can be used to disable auth for this specific routes
}

export enum FragmentTypeEnum {
	Landscape = 'Landscape',
	Portrait = 'Portrait',
	Presentation = 'Presentation',
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
