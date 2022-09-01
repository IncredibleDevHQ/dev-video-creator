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

import { NodeViewContent, NodeViewWrapper } from '@tiptap/react'
import { listLanguages } from 'lowlight/lib/core'
import allowedLanguages from '../../utils/allowedLanguages'

const CodeBlockComponent = ({
	node: {
		attrs: { language: defaultLanguage, id },
	},
	updateAttributes,
}: any) => (
	<NodeViewWrapper id={id} className='relative flex flex-col my-6'>
		<select
			className='border-none absolute top-0 right-0 px-1 py-1 mt-2.5 mr-2 text-size-sm text-gray-400 transition-all duration-200 bg-transparent rounded-sm cursor-pointer hover:text-gray-600 hover:bg-gray-200 focus:outline-none'
			contentEditable={false}
			defaultValue={
				Object.keys(allowedLanguages).find(
					key => (allowedLanguages as any)[key] === `.${defaultLanguage}`
				) || defaultLanguage
			}
			onChange={event => updateAttributes({ language: event.target.value })}
		>
			<option value='null'>auto</option>
			<option disabled>—</option>
			{listLanguages().map((lang: string) => (
				<option key={lang} value={lang}>
					{lang}
				</option>
			))}
		</select>
		<pre spellCheck={false}>
			<NodeViewContent as='code' />
		</pre>
		<span className='ml-auto mt-1 text-size-xxs text-gray-400'>
			Shift + Enter to exit code
		</span>
	</NodeViewWrapper>
)

export default CodeBlockComponent
