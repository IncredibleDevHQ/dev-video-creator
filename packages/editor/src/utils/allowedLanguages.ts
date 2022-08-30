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
