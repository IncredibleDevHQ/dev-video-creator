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

import { PrismaClient } from '@prisma/client'
import themes from './data/themes'
import transitions from './data/transitions'

const prisma = new PrismaClient()

async function main() {
	// Seed themes
	console.log('Seeding themes ...')
	await prisma.$transaction([
		prisma.theme.deleteMany({ where: {} }),
		prisma.theme.createMany({ data: themes }),
	])
	console.log(`Added ${themes.length} themes.`)

	// Seed transitions
	console.log('Seeding transitions...')
	await prisma.$transaction([
		prisma.transition.deleteMany({ where: {} }),
		prisma.transition.createMany({ data: transitions }),
	])
	console.log(`Added ${transitions.length} transitions.`)
}

main()
	.then(async () => {
		await prisma.$disconnect()
	})
	.catch(async e => {
		console.error(e)
		await prisma.$disconnect()
		process.exit(1)
	})
