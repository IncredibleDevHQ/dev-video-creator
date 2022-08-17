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
