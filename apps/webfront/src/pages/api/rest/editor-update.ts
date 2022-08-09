import { NextApiRequest, NextApiResponse } from 'next'
import prisma from 'prisma-orm/prisma'

type Payload = {
	fragmentId: string
	encodedEditorValue: string
	editorState: string
}

const editorUpdate = async (req: NextApiRequest, res: NextApiResponse) => {
	if (req.headers['x-secret'] !== process.env.NEXT_PUBLIC_WEBHOOK_SECRET) {
		res.status(401).send({})
		return
	}

	const { fragmentId, encodedEditorValue, editorState } = req.body as Payload
	try {
		prisma.fragment.update({
			where: {
				id: fragmentId,
			},
			data: {
				encodedEditorValue,
				editorState,
			},
		})
		res.status(200).send({})
	} catch (e) {
		console.error(e)
		res.status(500).send({})
	}
}

export default editorUpdate
