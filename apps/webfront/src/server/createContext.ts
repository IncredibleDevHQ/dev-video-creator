import { NextApiRequest, NextApiResponse } from 'next'
import verifyJwt from '../utils/jwt'

async function getUserFromRequest(req: NextApiRequest) {
	const token = req.headers.authorization
	if (token) {
		try {
			const v = await verifyJwt(token)
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
