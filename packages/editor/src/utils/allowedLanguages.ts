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

const allowedLanguages = {
	batch: '.bat',
	c: '.c',
	'c++': '.cpp',
	clojure: '.clj',
	css: '.css',
	dockerfile: '.dockerfile',
	go: '.go',
	html: '.html',
	jade: '.jade',
	java: '.java',
	javascript: '.js',
	javascriptreact: '.jsx',
	json: '.json',
	markdown: '.md',
	'objective-c': '.m',
	perl: '.pl',
	php: '.php',
	powershell: '.ps1',
	properties: '.properties',
	python: '.py',
	r: '.r',
	ruby: '.rb',
	rust: '.rs',
	scss: '.scss',
	shellscript: '.sh',
	sql: '.sql',
	swift: '.swift',
	typescript: '.ts',
	typescriptreact: '.tsx',
	xml: '.xml',
	yaml: '.yaml',
	graphql: '.graphql',
	haskell: '.hs',
	matlab: '.m',
}

const allowedExtensions: string[] = Object.values(allowedLanguages)

export { allowedExtensions }
export default allowedLanguages
