import admin from 'firebase-admin'
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
