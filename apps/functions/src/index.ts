import * as functions from 'firebase-functions'
// import * as Sentry from '@sentry/node'
import { generateSuggestionsFromEmail } from 'utils/src/helpers/suggestion'
import prisma from 'prisma-orm/prisma'

export const createHasuraUser = functions.auth.user().onCreate(async user => {
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
	} catch (e) {
		// Sentry.captureException(e)
		console.error(e)
	}
})

// Take the text parameter passed to this HTTP endpoint and insert it into
// Firestore under the path /messages/:documentId/original

// exports.date = functions.https.onRequest((req, res) => {
// 	const x = generateSuggestionsFromEmail('a@g.com')
// 	res.send(x)
// })
