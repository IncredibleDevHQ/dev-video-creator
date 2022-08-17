// Copyright (c) 2022 Pixelbyte Studio Pvt Ltd
//
// This file is part of Incredible, Pixelbyte Studio Pvt Ltd
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program\.  If not, see <http://www\.gnu\.org/licenses/>\.

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
