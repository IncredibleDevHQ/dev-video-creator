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
