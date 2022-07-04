import { NextApiRequest, NextApiResponse } from 'next'

const initMiddleware =
	(middleware: any) => (req: NextApiRequest, res: NextApiResponse) =>
		new Promise((resolve, reject) => {
			middleware(req, res, (result: any) => {
				if (result instanceof Error) {
					return reject(result)
				}
				return resolve(result)
			})
		})

export default initMiddleware
