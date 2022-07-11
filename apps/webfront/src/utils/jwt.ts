import { initFirebaseAdmin } from '../server/utils/helpers'

async function verifyJwt(token: string) {
	if (!token) {
		return null
	}
	const admin = initFirebaseAdmin()
	const decoded = await admin.auth().verifyIdToken(token)
	return decoded
}

export default verifyJwt
