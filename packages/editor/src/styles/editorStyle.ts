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



import { css } from '@emotion/css'

const editorStyle = css`
	background: none;
	background-color: transparent;

	img {
		margin-top: 1em;
		margin-bottom: 0;
	}

	code {
		color: #16a349;
		font-weight: 600;
		font-size: 0.875em;
		background-color: #f3f4f6;
		padding: 0.25em 0.5em;
		border-radius: 3px;
	}

	code::before {
		content: '';
	}

	code::after {
		content: '';
	}

	h1,
	h2,
	h3,
	h4,
	h5,
	h6 {
		color: rgba(31, 41, 55);
		font-family: Gilroy, ui-sans-serif, system-ui, -apple-system,
			BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial,
			'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji',
			'Segoe UI Symbol', 'Noto Color Emoji';
	}

	p {
		color: rgba(75, 85, 99);
		font-family: 'InterBody';
		word-wrap: break-word;
	}

	p.is-empty::before,
	h1.is-empty::before,
	h2.is-empty::before,
	h3.is-empty::before,
	h4.is-empty::before,
	h5.is-empty::before,
	h6.is-empty::before {
		color: rgba(209, 213, 219);
		content: attr(data-placeholder);
		float: left;
		height: 0;
		pointer-events: none;
	}

	pre {
		display: block;
		overflow-x: auto;
		padding: 1em;
		color: #383a42;
		background: #f3f4f6;
		margin: 0px;
		code {
			color: #16a349;
			font-weight: 600;
			font-size: 1.1em;
			background-color: #f3f4f6;
			border-radius: 3px;
			padding: 0;
		}
	}

	.hljs-comment,
	.hljs-quote {
		color: #a0a1a7;
		font-style: italic;
	}

	.hljs-doctag,
	.hljs-keyword,
	.hljs-formula {
		color: #a626a4;
	}

	.hljs-section,
	.hljs-name,
	.hljs-selector-tag,
	.hljs-deletion,
	.hljs-subst {
		color: #e45649;
	}

	.hljs-literal {
		color: #0184bb;
	}

	.hljs-string,
	.hljs-regexp,
	.hljs-addition,
	.hljs-attribute,
	.hljs-meta .hljs-string {
		color: #50a14f;
	}

	.hljs-attr,
	.hljs-variable,
	.hljs-template-variable,
	.hljs-type,
	.hljs-selector-class,
	.hljs-selector-attr,
	.hljs-selector-pseudo,
	.hljs-number {
		color: #986801;
	}

	.hljs-symbol,
	.hljs-bullet,
	.hljs-link,
	.hljs-meta,
	.hljs-selector-id,
	.hljs-title {
		color: #4078f2;
	}

	.hljs-built_in,
	.hljs-title.class_,
	.hljs-class .hljs-title {
		color: #c18401;
	}

	.hljs-emphasis {
		font-style: italic;
	}

	.hljs-strong {
		font-weight: bold;
	}

	.hljs-link {
		text-decoration: underline;
	}

	.collaboration-cursor__caret {
		border-left: 1px solid #0d0d0d;
		border-right: 1px solid #0d0d0d;
		margin-left: -1px;
		margin-right: -1px;
		pointer-events: none;
		position: relative;
		word-break: normal;
	}

	/* Render the username above the caret */
	.collaboration-cursor__label {
		border-radius: 3px 3px 3px 0;
		color: #0d0d0d;
		font-size: 12px;
		font-style: normal;
		font-weight: 600;
		font-family: 'Inter', sans-serif;
		left: -1px;
		line-height: normal;
		padding: 0.1rem 0.3rem;
		position: absolute;
		top: -1.4em;
		user-select: none;
		white-space: nowrap;
	}
`
export default editorStyle
