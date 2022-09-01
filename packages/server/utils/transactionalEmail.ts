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

import { APIClient, SendEmailRequest } from 'customerio-node'

/*
  CUSTOMER IO TRANSACTIONAL EMAIL
*/

import serverEnvs from './env'

export enum TransactionalMailType {
	CREATE_STORY = 'CREATE_STORY',
	MAGIC_LINK = 'MAGIC_LINK',
	COLLABORATION = 'COLLABORATION',
	EXTERNAL_COLLABORATION = 'EXTERNAL_COLLABORATION',
	COLLABORATION_ACCEPTED = 'COLLABORATION_ACCEPTED',
	NOTIFY_PUBLISH = 'NOTIFY_PUBLISH',
}

// ref- https://customer.io/docs/transactional-api/
export const TransactionalMessageIds: {
	[key in TransactionalMailType]: string
} = {
	CREATE_STORY: '2',
	MAGIC_LINK: '3',
	COLLABORATION: '4',
	EXTERNAL_COLLABORATION: '5',
	COLLABORATION_ACCEPTED: '6',
	NOTIFY_PUBLISH: '7',
}

export interface CreateStoryMailConfig {
	receiverName: string
	storyTitle: string
	btnUrl: string
}

export interface SendMagicLinkMailConfig {
	magicLink: string
}

export interface CollaborationMailConfig {
	btnUrl: string
	senderName: string
	storyTitle: string
}

export interface CollaborationAcceptMailConfig {
	receiverName: string
	storyTitle: string
	btnUrl: string
}

export interface NotifyOnPublishMailConfig {
	storyTitle: string
	btnUrl: string
}

export interface TransactionalMailConfig {
	mailType: TransactionalMailType
	sendToEmail: string
	messageData:
		| CreateStoryMailConfig
		| SendMagicLinkMailConfig
		| CollaborationMailConfig
		| CollaborationAcceptMailConfig
		| NotifyOnPublishMailConfig
}

export const sendTransactionalEmail = async (data: TransactionalMailConfig) => {
	try {
		if (!data.sendToEmail || data.sendToEmail.length === 0) {
			// eslint-disable-next-line no-console
			console.log(
				'Could not find email address to send transactional email in data=',
				data
			)
			throw new Error('Email is required')
		}

		const client = new APIClient(
			serverEnvs.CUSTOMERIO_TRANSACTIONAL_APP_API_KEY
		)

		let templateData
		switch (data.mailType) {
			case TransactionalMailType.CREATE_STORY: {
				const messageData = data.messageData as CreateStoryMailConfig
				templateData = {
					receiverName: messageData.receiverName,
					storyTitle: `"${
						messageData.storyTitle === 'Untitled' ? '' : messageData.storyTitle
					}"`,
					btnUrl: messageData.btnUrl,
				}
				break
			}
			case TransactionalMailType.MAGIC_LINK: {
				templateData = data.messageData as SendMagicLinkMailConfig
				break
			}
			case TransactionalMailType.COLLABORATION:
			case TransactionalMailType.EXTERNAL_COLLABORATION: {
				templateData = data.messageData as CollaborationMailConfig
				break
			}
			case TransactionalMailType.COLLABORATION_ACCEPTED: {
				templateData = data.messageData as CollaborationAcceptMailConfig
				break
			}
			case TransactionalMailType.NOTIFY_PUBLISH: {
				templateData = data.messageData as NotifyOnPublishMailConfig
				break
			}
			default: {
				throw new Error('Invalid mail type')
			}
		}

		// Note customer.io allows upto 15 emails in a single request (including both bcc and to)
		// send multiple emails in a single attribute with comma separated values
		const request = new SendEmailRequest({
			to: data.sendToEmail,
			transactional_message_id: TransactionalMessageIds[data.mailType],
			identifiers: {
				email: data.sendToEmail,
			},
			message_data: templateData,
		})

		const res = await client.sendEmail(request)
		// eslint-disable-next-line no-console
		console.log(`Completed ${data.mailType} with response: `, res.data)

		return
	} catch (e) {
		// eslint-disable-next-line no-console
		console.log(
			'Something went wrong while calling customerio transactional-email api for : ',
			data
		)
		throw e
		// TODO: alert on sentry
	}
}
