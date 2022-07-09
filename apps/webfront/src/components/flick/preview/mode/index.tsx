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
