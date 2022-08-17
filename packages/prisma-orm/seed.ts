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
