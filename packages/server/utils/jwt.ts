import { initFirebaseAdmin } from './helpers'

async function verifyJwt(token: string) {
	if (!token) {
		return null
	}
	try {
		const admin = initFirebaseAdmin()
		const decoded = await admin.auth().verifyIdToken(token)
		return decoded
	} catch (e) {
		console.log(e)
		return null
	}
}

async function verifyCookie(cookie: string) {
	try {
		const admin = initFirebaseAdmin()
		const decoded = await admin.auth().verifySessionCookie(cookie)
		return decoded
	} catch (e) {
		console.log(e)
		return null
	}
}

export { verifyJwt, verifyCookie }
