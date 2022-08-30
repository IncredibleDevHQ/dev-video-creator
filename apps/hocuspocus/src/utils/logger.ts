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



import * as Sentry from '@sentry/node'

const now = () => new Date().toISOString()

class Logger {
	static log(message: string) {
		console.log(`[${now()}] ${message}`)
	}

	static error(message: string, context?: any) {
		Sentry.captureException(new Error(message), {
			contexts: context?.invocationId
				? {
						invocationId: context.invocationId,
				  }
				: undefined,
			user: context?.user
				? {
						id: context.user.id,
						email: context.user.email,
				  }
				: undefined,
		})
		console.error(`[${now()}] ${message}`)
	}
}

export default Logger
