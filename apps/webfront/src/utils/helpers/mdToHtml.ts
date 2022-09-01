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
