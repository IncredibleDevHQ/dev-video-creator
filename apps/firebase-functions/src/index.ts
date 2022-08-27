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



/* eslint-disable import/prefer-default-export */
import * as functions from 'firebase-functions'
import axios from 'axios'

export const createDBUser = functions
	.runWith({
		secrets: ['WEBHOOK_SECRET'],
	})
	.auth.user()
	.onCreate(async user => {
		try {
			if (!user) throw new Error('User is null')
			const data = JSON.stringify(user)

			const url = 'https://alpha.incredible.dev/api/webhook/new-user'
			const secret = process.env.WEBHOOK_SECRET

			if (!secret) throw new Error("Invalid ENV's provided")
			await axios.post(url, data, {
				headers: {
					'Content-Type': 'application/json',
					'x-secret': secret,
				},
			})
		} catch (e) {
			// Sentry.captureException(e)
			console.error(e)
		}
	})
