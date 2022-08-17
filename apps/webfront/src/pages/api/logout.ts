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
import setCookie from 'src/utils/helpers/setCookie'

const cors = initMiddleware(
	Cors({
		origin: true,
		credentials: true,
	})
)

const logout = async (req: NextApiRequest, res: NextApiResponse) => {
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
		// If session Cookie is present revoke it
		if (sessionCookie) {
			const decodedClaims = await auth().verifySessionCookie(
				sessionCookie,
				true
			)
			await auth().revokeRefreshTokens(decodedClaims.sub)
		}
		// clear session cookie on the client
		setCookie(res, '__session', '', {
			maxAge: -1,
		})
		return res.status(200).send('Logged out')
	} catch (e) {
		const error = e as Error
		return res.status(501).json({ success: false, message: error.message })
	}
}

export default logout
