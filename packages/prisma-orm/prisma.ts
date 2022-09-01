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

/**
 * Instantiates a single instance PrismaClient and save it on the global object.
 * @link https://www.prisma.io/docs/support/help-articles/nextjs-prisma-client-dev-practices
 */
import { PrismaClient } from '@prisma/client'

const prismaGlobal = global as typeof global & {
	prisma?: PrismaClient
}

const prisma: PrismaClient =
	prismaGlobal.prisma ||
	new PrismaClient({
		datasources: {
			db: { url: process.env.DATABASE_URL },
		},
		// log:
		// 	process.env.NODE_ENV === 'development' || !process.env.NODE_ENV
		// 		? ['query', 'error', 'warn']
		// 		: ['error'],
	})

if (process.env.NODE_ENV !== 'production') {
	prismaGlobal.prisma = prisma
}

export default prisma
