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

const initMiddleware =
	(middleware: any) => (req: NextApiRequest, res: NextApiResponse) =>
		new Promise((resolve, reject) => {
			middleware(req, res, (result: any) => {
				if (result instanceof Error) {
					return reject(result)
				}
				return resolve(result)
			})
		})

export default initMiddleware
