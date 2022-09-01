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

import { BlockView } from 'utils/src'
import CodeBlockMode from './CodeBlockMode'
import ImageBlockMode from './ImageBlockMode'
import ListBlockMode from './ListBlockMode'
import VideoBlockMode from './VideoBlockMode'

const ModeSelector = ({
	view,
	updateView,
}: {
	view: BlockView | undefined
	updateView: (view: BlockView) => void
}) => {
	if (!view) return null

	return (() => {
		switch (view.type) {
			case 'codeBlock':
				return <CodeBlockMode view={view} updateView={updateView} />
			case 'imageBlock':
				return <ImageBlockMode view={view} updateView={updateView} />
			case 'videoBlock':
				return <VideoBlockMode view={view} updateView={updateView} />
			case 'listBlock':
				return <ListBlockMode view={view} updateView={updateView} />
			default:
				return null
		}
	})()
}

export default ModeSelector
