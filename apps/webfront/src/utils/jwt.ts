import admin from 'firebase-admin'

async function verifyJwt(token: string) {
	if (!token) return null
	if (!admin.apps.length) {
		admin.initializeApp({
			credential: admin.credential.cert(
				JSON.parse(process.env.FIREBASE_SERVICE_CONFIG as string)
			),
		})
	}
	const decoded = await admin.auth().verifyIdToken(token)
	return decoded
}

export default verifyJwt
