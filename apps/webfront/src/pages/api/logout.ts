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
