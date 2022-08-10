import { NextApiRequest, NextApiResponse } from 'next'
import prisma from 'prisma-orm/prisma'
import serverEnvs from 'server/utils/env'
import { generateSuggestionsFromEmail } from 'utils/src/helpers/suggestion'

const createNewUser = async (req: NextApiRequest, res: NextApiResponse) => {
	if (req.headers['x-secret'] !== serverEnvs.WEBHOOK_SECRET) {
		res.status(401).send({})
		return
	}

	const { user } = req.body
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
		res.status(500).send({
			error: e,
		})
	}
}

export default createNewUser
