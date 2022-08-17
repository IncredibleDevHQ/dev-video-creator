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

import admin from 'firebase-admin'
import { NextApiRequest, NextApiResponse } from 'next'
import serverEnvs from 'server/utils/env'
import setCookie from 'src/utils/helpers/setCookie'

const login = async (req: NextApiRequest, res: NextApiResponse) => {
	res.setHeader(
		'Access-Control-Allow-Headers',
		'Access-Control-Allow-Origin,Content-Type,Access-Control-Allow-Credentials'
	)

	const requestMethod = req.method || 'GET'

	// Allow preflight to detect available http methods, and avoid CORS
	if (['OPTIONS'].includes(requestMethod)) {
		res.setHeader('Access-Control-Allow-Methods', 'POST')
		res.setHeader('Access-Control-Allow-Credentials', 'true')
		return res.status(200).send('success')
	}

	if (['POST', 'post'].includes(requestMethod)) {
		try {
			if (!admin.apps.length) {
				admin.initializeApp({
					credential: admin.credential.cert(
						JSON.parse(serverEnvs.FIREBASE_SERVICE_CONFIG as string)
					),
				})
			}

			// verify idToken
			const { idToken } = req.body
			const decodedIdToken = await admin.auth().verifyIdToken(idToken, true)

			// session expiry
			const expiresIn = 12 * 60 * 60 * 24 * 1000 // 12 days

			// if decoded set cookie
			if (decodedIdToken) {
				admin.app()

				const sessionCookie = await admin.auth().createSessionCookie(idToken, {
					expiresIn,
				})

				// Set cookie policy for session cookie.
				// The cookie should have httpOnly=true, secure=true and sameSite=strict set
				setCookie(res, '__session', sessionCookie, {
					maxAge: expiresIn,
					httpOnly: true,
					secure: true,
					path: '/',
					domain: serverEnvs.COOKIE_DOMAIN as string,
					sameSite: 'none',
				})

				res.setHeader('Access-Control-Allow-Credentials', 'true')
				return res.end(JSON.stringify({ sessionCookie }))
			}
			return res.status(500).send({})
		} catch (e) {
			const error = e as Error
			return res.status(501).json({ success: false, message: error.message })
		}
	} else {
		return res.status(501).end()
	}
}

export default login
