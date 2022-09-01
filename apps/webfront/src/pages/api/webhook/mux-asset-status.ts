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

import Mux from '@mux/mux-node'

import { NextApiRequest, NextApiResponse } from 'next'
import prisma from 'prisma-orm/prisma'
import serverEnvs from 'server/utils/env'

interface MuxMetaPassThrough {
	contentId: string
}

// Reference: https://docs.mux.com/guides/video/listen-for-webhooks
export type MuxWebhookResponse = {
	type: string
	object: {
		type: string
		id: string
	}
	id: string
	environment: {
		name: string
		id: string
	}
	data: {
		tracks: Array<{
			type: string
			max_width?: number
			max_height?: number
			max_frame_rate?: number
			id: string
			duration: number
			max_channels?: number
			max_channel_layout?: string
		}>
		status: string
		max_stored_resolution: string
		max_stored_frame_rate: number
		id: string
		duration: number
		created_at: string
		aspect_ratio: string
		passthrough?: string
	}
	created_at: string
	accessor_source: any
	accessor: any
	request_id: any
}

const signingSecret = serverEnvs.MUX_SIGNING_SECRET // mux.signingSecret

/*
  Note: mux webhook will timeout in 5sec and start retry , so keep it quick here.
*/
export const muxAssetStatus = async (
	req: NextApiRequest,
	res: NextApiResponse
) => {
	try {
		if (!signingSecret) {
			return res.status(500).send('No mux signing secret!')
		}
		// Verify webhook signature
		try {
			const signature = req.headers['mux-signature']
			const isValidSignature = Mux.Webhooks.verifyHeader(
				JSON.stringify(req.body),
				signature as string,
				signingSecret
			)
			if (!isValidSignature) {
				throw new Error('Invalid Signature')
			}
		} catch (e) {
			console.log('Invalid webhook received')
			console.error(
				'Invalid request: ',
				req.body,
				' from origin ',
				req.headers.origin
			)
			return res
				.status(200)
				.json({ received: true, status: 'Invalid webhook received' })

			// Sentry.captureException(
			// 	new Error(
			// 		'Failed to parse webhook. Request Validation failed for id: ' +
			// 			req.body.id
			// 	)
			// )
		}

		const data = req.body as MuxWebhookResponse

		// Update mux tracking table . assetStatus to completed
		if (data.type === 'video.asset.ready') {
			if (!data.data.passthrough) {
				// Sentry.captureException(
				// 	new Error(
				// 		'Mux Webhook: Failed to update state to ready.Passthrough is missing for id: ' +
				// 			data.id +
				// 			' requestId : ' +
				// 			data.request_id
				// 	)
				// )
				return res.send('PassThrough is missing')
			}

			if (!data.data.status) {
				return res.send('Status is missing')
			}

			const passthrough = JSON.parse(
				data.data.passthrough
			) as MuxMetaPassThrough

			const muxReady = await prisma.mux_Assets.update({
				where: { contentId: passthrough.contentId },
				data: {
					muxAssetStatus: data.data.status,
				},
				select: {
					muxAssetId: true,
				},
			})
			// sdk.MarkMuxAssetReady({
			// contentId: passthrough.contentId,
			// status: data.data.status,
			// })

			if (!muxReady) {
				// Sentry.captureException(
				// 	new Error(
				// 		"Mux Webhook: Muc tracking table failed doesn't contain entry for contentId: " +
				// 			passthrough.contentId
				// 	)
				// )
				return res.send('Failed to update state to ready')
			}
			return res.send('Successful')
		}

		return res.json({ received: true })
	} catch (e) {
		console.log(e)
		// Sentry.captureException(e)
		// sending back non 200 status causes mux to retry
		return res.status(500).json({ received: true })
	}
}
