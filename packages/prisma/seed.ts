import { PrismaClient } from '@prisma/client'
import { themes } from './data/themes'
import { transitions } from './data/transitions'
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
