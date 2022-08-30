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



/* eslint-disable no-nested-ternary */
import { Database } from '@hocuspocus/extension-database'
import { Logger as ExtensionLogger } from '@hocuspocus/extension-logger'
import { Redis } from '@hocuspocus/extension-redis'
import { Server } from '@hocuspocus/server'
import { TiptapTransformer } from '@hocuspocus/transformer'
import * as Sentry from '@sentry/node'
import axios from 'axios'
import dotenv from 'dotenv'
import { nanoid } from 'nanoid'
import { createClient } from 'redis'
import parser from './utils/astParser'
import Logger from './utils/logger'

dotenv.config()

const redisClient = createClient({
	socket: {
		host: process.env.REDIS_ENDPOINT,
		port: Number(process.env.REDIS_PORT),
	},
	password: process.env.REDIS_PASSWORD,
})

if (process.env.ENVIRONMENT !== 'development') {
	Sentry.init({
		environment: process.env.ENVIRONMENT,
		dsn: process.env.SENTRY_DSN,
		tracesSampleRate: 0.5,
	})
}

const startHocuspocus = () => {
	const server = Server.configure({
		port: 8765,
		timeout: 2000,
		maxDebounce: 5000,
		extensions: [
			new ExtensionLogger({
				onChange: false,
				onUpgrade: false,
			}),
			new Redis({
				host: process.env.REDIS_ENDPOINT,
				port: Number(process.env.REDIS_PORT),
				options: {
					password: process.env.REDIS_PASSWORD,
				},
			}),
			new Database({
				fetch: async ({ documentName }) =>
					new Promise((resolve, reject) => {
						redisClient.json
							.get(documentName)
							.then(data => {
								if (!data) {
									reject(
										new Error(
											`[${new Date().toISOString()}] No data found for ${documentName}`
										)
									)
								} else {
									const { raw } = JSON.parse(JSON.stringify(data))
									if (!raw) {
										reject(
											new Error(
												`[${new Date().toISOString()}] No data found for ${documentName}`
											)
										)
									} else {
										resolve(Buffer.from(raw, 'binary'))
									}
								}
							})
							.catch(e => {
								reject(e)
							})
					}),
				store: async ({ documentName, state, document, context }) => {
					const invocationId = nanoid()

					const { default: documentJSON } = TiptapTransformer.fromYdoc(document)

					let ast: any = documentJSON ? await parser(documentJSON) : null

					const storedData = await redisClient.json.get(documentName)
					if (!storedData) {
						Logger.log(
							`Save aborted. No stored data for doc: ${documentName} invocationId: ${invocationId}`
						)
						return
					}

					const { ast: storedAST } = JSON.parse(JSON.stringify(storedData))

					if (ast && ast.blocks) {
						ast = {
							blocks: [
								...(storedAST?.blocks
									? storedAST?.blocks[0]?.type === 'introBlock'
										? [storedAST.blocks[0]]
										: []
									: []),
								...ast.blocks,
								...(storedAST?.blocks
									? storedAST?.blocks?.[storedAST?.blocks?.length ?? 0 - 1]
											?.type === 'outroBlock'
										? [
												{
													...storedAST.blocks[storedAST.blocks.length - 1],
													pos: ast.blocks.length + 1,
												},
										  ]
										: []
									: []),
							],
						}
					} else {
						ast = storedAST
					}

					redisClient.json
						.set(documentName, '$', {
							raw: Buffer.from(state).toString('binary'),
							json: documentJSON,
							ast,
						})
						.then(() =>
							Logger.log(
								`Stored on redis doc: ${documentName} invocationId: ${invocationId}`
							)
						)
						.catch(e =>
							Logger.error(
								`Error storing on redis doc: ${documentName} invocationId: ${invocationId} error: ${e}`,
								{ ...context, invocationId }
							)
						)

					axios
						.post(
							`${process.env.ENDPOINT}/api/webhook/editor-update`,
							{
								fragmentId: documentName,
								encodedEditorValue: documentJSON
									? Buffer.from(JSON.stringify(documentJSON)).toString('base64')
									: null,
								editorState: ast,
							},
							{
								headers: {
									'Content-Type': 'application/json',
									'x-secret': `${process.env.WEBHOOK_SECRET}`,
								},
							}
						)
						.then(() =>
							Logger.log(
								`Stored on postgres doc: ${documentName} invocationId: ${invocationId}`
							)
						)
						.catch(e =>
							Logger.error(
								`Error storing on postgres doc: ${documentName} invocationId: ${invocationId} error: ${e}`,
								{ ...context, invocationId }
							)
						)
				},
			}),
		],
	})

	server.listen()
}

const start = async () => {
	try {
		await redisClient.connect()
		startHocuspocus()
	} catch (e) {
		Logger.error(`Error connecting to redis: ${e}`)
	}
}

start()
