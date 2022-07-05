import { NextApiRequest, NextApiResponse } from 'next'
import * as firebase from 'firebase-admin'
import verifyJwt from '../utils/jwt'

async function getUserFromRequest(req: NextApiRequest) {
	// eslint-disable-next-line no-underscore-dangle
	const token = req.headers.authorization
	if (token) {
		try {
			const v = await verifyJwt<firebase.auth.DecodedIdToken>(token)
			return v
		} catch (e) {
			// TODO: Add logger
			return null
		}
	}
	return null
}

export async function createContext({
	req,
	res,
}: {
	req: NextApiRequest
	res: NextApiResponse
}) {
	const user = await getUserFromRequest(req)
	return { req, res, user }
}

export type Context = ReturnType<typeof createContext>
