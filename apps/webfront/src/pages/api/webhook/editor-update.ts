// Copyright 2022 Pixelbyte Studio Pvt Ltd
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

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
