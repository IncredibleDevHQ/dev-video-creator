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
