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

/* eslint-disable no-underscore-dangle */
import Cors from 'cors'
import admin, { auth } from 'firebase-admin'
import { NextApiRequest, NextApiResponse } from 'next'
import serverEnvs from 'server/utils/env'
import initMiddleware from 'src/utils/helpers/initMiddleware'

const cors = initMiddleware(
	Cors({
		origin: true,
		credentials: true,
		allowedHeaders: ['Access-Control-Allow-Origin'],
		methods: ['GET', 'POST'],
	})
)

const status = async (req: NextApiRequest, res: NextApiResponse) => {
	res.setHeader(
		'Access-Control-Allow-Headers',
		'Access-Control-Allow-Origin,Content-Type,Access-Control-Allow-Credentials'
	)

	// Allow preflight to detect available http methods, and avoid CORs
	if (['OPTIONS'].includes(req.method ?? 'OPTIONS')) {
		res.setHeader('Access-Control-Allow-Methods', 'POST')
		res.setHeader('Access-Control-Allow-Credentials', 'true')
		return res.status(200).send('success')
	}

	if (['GET', 'get', 'POST', 'post'].includes(req.method ?? 'OPTIONS')) {
		try {
			await cors(req, res)
			if (!admin.apps.length) {
				admin.initializeApp({
					credential: admin.credential.cert(
						JSON.parse(serverEnvs.FIREBASE_SERVICE_CONFIG as string)
					),
				})
			}
			const sessionCookie = req.cookies?.__session || ''
			if (sessionCookie) {
				const decodedClaims = await auth().verifySessionCookie(
					sessionCookie,
					true
				)
				const token = await auth().createCustomToken(decodedClaims.sub)

				return res.status(200).send(token)
			}
			return res.status(401).send('Session cookie is unavailable')
		} catch (e) {
			const error = e as Error

			return res.status(501).json({ success: false, message: error.message })
		}
	} else {
		return res.status(501).end()
	}
}
export default status
