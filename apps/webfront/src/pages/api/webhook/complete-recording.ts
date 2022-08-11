import { NextApiRequest, NextApiResponse } from 'next'
import prisma from 'prisma-orm/prisma'
import serverEnvs from 'server/utils/env'
import { RecordingStatusEnum } from 'utils/src/enums'

type Payload = {
	recordingId: string
	flickId: string
	outputKey: string
	orientation?: string
}

const completeRecording = async (req: NextApiRequest, res: NextApiResponse) => {
	if (req.headers['x-secret'] !== serverEnvs.WEBHOOK_SECRET) {
		res.status(401).send({})
		return
	}

	const { recordingId, outputKey } = req.body as Payload
	try {
		await prisma.recording.update({
			where: {
				id: recordingId,
			},
			data: {
				url: outputKey,
				status: RecordingStatusEnum.Completed,
			},
		})
		res.status(200).send({})
	} catch (e) {
		// TODO: Sentry.captureException(e)
		console.error(e)
		res.status(500).send({})
	}
}

export default completeRecording
