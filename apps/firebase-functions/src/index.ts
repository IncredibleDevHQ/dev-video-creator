/* eslint-disable import/prefer-default-export */
import * as functions from 'firebase-functions'
import axios from 'axios'

export const createDBUser = functions
	.runWith({
		secrets: ['WEBHOOK_SECRET'],
	})
	.auth.user()
	.onCreate(async user => {
		try {
			if (!user) throw new Error('User is null')
			const data = JSON.stringify(user)

			const url = 'https://alpha.incredible.dev/api/webhook/new-user'
			const secret = process.env.WEBHOOK_SECRET

			if (!secret) throw new Error("Invalid ENV's provided")
			await axios.post(url, data, {
				headers: {
					'Content-Type': 'application/json',
					'x-secret': secret,
				},
			})
		} catch (e) {
			// Sentry.captureException(e)
			console.error(e)
		}
	})
