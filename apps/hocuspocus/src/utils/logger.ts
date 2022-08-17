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
