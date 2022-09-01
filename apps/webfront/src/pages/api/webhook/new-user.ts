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

import { NextApiRequest, NextApiResponse } from 'next'
import prisma from 'prisma-orm/prisma'
import serverEnvs from 'server/utils/env'
import { generateSuggestionsFromEmail } from 'utils/src/helpers/suggestion'

const createNewUser = async (req: NextApiRequest, res: NextApiResponse) => {
	if (req.headers['x-secret'] !== serverEnvs.WEBHOOK_SECRET) {
		res.status(401).send({})
		return
	}

	const user = req.body
	const username = generateSuggestionsFromEmail(user.email as string)
	const [providerData] = user.providerData
	try {
		const newUser = await prisma.user.create({
			data: {
				sub: user.uid,
				picture: user.photoURL,
				email: user.email,
				displayName: user.displayName,
				username,
				provider: providerData.providerId,
				verified: user.emailVerified,
			},
		})

		if (!newUser) {
			throw Error('FATAL: Failed to create new user on Database!')
		}

		// Initialize Profile
		const profile = await prisma.profile.create({
			data: {
				userSub: user.uid,
				tags: 'incredible-creator',
			},
		})
		if (!profile) {
			throw Error('FATAL: Failed to create new user profile on Database!')
		}
		res.status(200).send({})
	} catch (e) {
		// Sentry.captureException(e)
		console.error(e)
		res.status(500).json({
			error: (e as unknown as any).message,
		})
	}
}

export default createNewUser
