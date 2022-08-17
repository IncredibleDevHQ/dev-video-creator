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
