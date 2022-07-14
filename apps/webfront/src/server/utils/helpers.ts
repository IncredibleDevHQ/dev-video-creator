import admin from 'firebase-admin'
import * as crypto from 'crypto'
import serverEnvs from '../../utils/env'

export interface Meta {
	hasAuth: boolean // can be used to disable auth for this specific routes
}

export const initFirebaseAdmin = () => {
	if (!admin.apps.length && serverEnvs.FIREBASE_SERVICE_CONFIG) {
		return admin.initializeApp({
			credential: admin.credential.cert(
				JSON.parse(serverEnvs.FIREBASE_SERVICE_CONFIG as string)
			),
		})
	}
	return admin
}

export function generateSuggestionsFromEmail(email: string): string[] {
	const suggestions = []

	for (let i = 0; i < 3; i += 1) {
		const nameParts = email.replace(/@.+/, '')
		const name = nameParts.replace(/[&/\\#,+()$~%._@'":*?<>{}]/g, '')
		suggestions.push(name + crypto.randomInt(100, 900).toString())
	}
	return suggestions
}
