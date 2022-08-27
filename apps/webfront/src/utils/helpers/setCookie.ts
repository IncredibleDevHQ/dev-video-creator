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



import { serialize, CookieSerializeOptions } from 'cookie'
import { NextApiResponse } from 'next'

const setCookie = (
	res: NextApiResponse,
	name: string,
	value: unknown,
	options: CookieSerializeOptions = {}
) => {
	const stringValue =
		typeof value === 'object' ? `j:${JSON.stringify(value)}` : String(value)

	res.setHeader('Set-Cookie', serialize(name, stringValue, options))
}

export default setCookie
