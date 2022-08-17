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
