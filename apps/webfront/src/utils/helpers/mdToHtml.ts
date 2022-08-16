import matter from 'gray-matter'
import { remark } from 'remark'
import html from 'remark-html'
import { promises as fs } from 'fs'
import path from 'path'

export default async function markdownToHtml(markdown: string) {
	const result = await remark().use(html).process(markdown)
	return result.toString()
}

export async function getPostBySlug(slug: string, fields: string[] = []) {
	const realSlug = slug.replace(/\.md$/, '')
	const mdDirectory = path.join(process.cwd(), 'data', 'legal')
	const fileContents = await fs.readFile(
		`${mdDirectory}/${realSlug}.md`,
		'utf8'
	)
	const { data, content } = matter(fileContents)

	type Items = {
		[key: string]: string
	}

	const items: Items = {}

	// Ensure only the minimal needed data is exposed
	fields.forEach(field => {
		if (field === 'slug') {
			items[field] = realSlug
		}
		if (field === 'content') {
			items[field] = content
		}
		if (field === 'date') {
			items[field] = JSON.stringify(data.date)
		} else if (typeof data[field] !== 'undefined') {
			items[field] = data[field]
		}
	})

	return items
}
