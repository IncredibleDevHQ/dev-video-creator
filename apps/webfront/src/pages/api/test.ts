import { NextApiRequest, NextApiResponse } from 'next'
import serverEnvs from 'src/utils/env'

const test = async (req: NextApiRequest, res: NextApiResponse) => {
	try {
		return res.status(200).send(JSON.stringify(serverEnvs))
	} catch (e) {
		const error = e as Error
		return res.status(501).json({ success: false, message: error.message })
	}
}

export default test
