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
