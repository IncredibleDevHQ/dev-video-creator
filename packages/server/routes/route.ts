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

import serverEnvs from '../utils/env'
import createRouter from '../createRouter'
import userRouter from './user'
import utilsRouter from './utils'
import storyRouter from './story'
import collaborateRouter from './collaborate'
import fragmentRouter from './fragment'
import recordingRouter from './record'
import blockRouter from './block'
import seriesRouter from './series'

const appRouter = createRouter()
	.merge('user.', userRouter)
	.merge('series.', seriesRouter)
	.merge('story.', storyRouter)
	.merge('collab.', collaborateRouter)
	.merge('fragment.', fragmentRouter)
	.merge('recording.', recordingRouter)
	.merge('block.', blockRouter)
	.merge('util.', utilsRouter)
	.query('healthz', {
		async resolve() {
			return 'Up!'
		},
	})
	// remove stack and trace from error as it may contain sensitive data
	.formatError(({ shape, error }) => ({
		...shape,
		data: {
			error: {
				code: error.code,
				message: serverEnvs.NODE_ENV !== 'production' ? error.message : '',
				stack: serverEnvs.NODE_ENV !== 'production' ? error.stack : '',
			},
		},
	}))

export type AppRouter = typeof appRouter

export default appRouter
