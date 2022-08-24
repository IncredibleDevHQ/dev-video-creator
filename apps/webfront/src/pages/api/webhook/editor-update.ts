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

import { NextApiRequest, NextApiResponse } from 'next'
import prisma from 'prisma-orm/prisma'
import serverEnvs from 'server/utils/env'

type Payload = {
	fragmentId: string
	encodedEditorValue: string
	editorState: string
}

const editorUpdate = async (req: NextApiRequest, res: NextApiResponse) => {
	if (req.headers['x-secret'] !== serverEnvs.WEBHOOK_SECRET) {
		res.status(401).send({})
		return
	}

	const { fragmentId, encodedEditorValue, editorState } = req.body as Payload
	try {
		await prisma.fragment.update({
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
