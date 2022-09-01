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

const tinyEditorStyle = css`
	background: none;
	background-color: transparent;

	p {
		color: white;
		font-family: 'Inter';
		word-wrap: break-word;
	}

	p.is-empty::before {
		color: rgba(209, 213, 219);
		content: attr(data-placeholder);
		float: left;
		height: 0;
		pointer-events: none;
	}
`

export default tinyEditorStyle
