import { Block, SimpleAST } from 'editor/src/utils/types'
import { atom, DefaultValue, selector } from 'recoil'
import { FlickParticipantsFragment } from 'src/graphql/generated'
import { IntroBlockViewProps, Layout } from 'utils/src'

/* Stores some basic flick details */
const flickAtom = atom<{
	id: string
	owner: {
		id: string
		sub: string
	}
} | null>({
	key: 'flick',
	default: null,
})

/* Stores name of the flick */
const flickNameAtom = atom<string | null>({
	key: 'flickName',
	default: null,
})

/* This atom keeps track of flick participants */
const participantsAtom = atom<FlickParticipantsFragment[]>({
	key: 'participants',
	default: [],
})

/* This atom stores the currently selected format */
const activeFragmentIdAtom = atom<string | null>({
	key: 'activeFragmentId',
	default: null,
})

/* This atom keeps track of whether to show the notebook or the full fledged canvas preview */
enum View {
	Notebook = 'notebook',
	Preview = 'preview',
}
const viewAtom = atom<View>({
	key: 'view',
	default: View.Notebook,
})

/* This atom stores the visible state of the timeline */
const isTimelineVisibleAtom = atom<boolean>({
	key: 'isTimelineVisible',
	default: false,
})

/* This atom stores the ast */
const astAtom = atom<SimpleAST | null>({
	key: 'ast',
	default: null,
})

/* Atom to store id of the currently selected block and selector to find and return the block based on id */
const currentBlockIdAtom = atom<string | null>({
	key: 'currentBlockId',
	default: null,
})
const currentBlockSelector = selector<Block | undefined>({
	key: 'currentBlock',
	get: ({ get }) => {
		const blocks = get(astAtom)?.blocks
		const id = get(currentBlockIdAtom)
		const current = blocks?.find(block => block.id === id)
		return current
	},
	set: ({ set }, value) => {
		if (value instanceof DefaultValue || value === undefined) return
		set(currentBlockIdAtom, value.id)
	},
})

/* Atom that stores preview position */
const previewPositionAtom = atom<number | null>({
	key: 'previewPosition',
	default: null,
})

/* Atom that stores thumbnail config of current fragment */
type ThumbnailProps = IntroBlockViewProps & { layout: Layout }
const thumbnailAtom = atom<ThumbnailProps | null>({
	key: 'thumbnail',
	default: null,
})

export type FragmentType = 'Portrait' | 'Landscape'
const fragmentTypeAtom = atom<FragmentType>({
	key: 'fragmentType',
	default: 'Landscape',
})

const openStudioAtom = atom<boolean>({
	key: 'openStudio',
	default: false,
})

export {
	flickAtom,
	flickNameAtom,
	activeFragmentIdAtom,
	viewAtom,
	astAtom,
	currentBlockIdAtom,
	currentBlockSelector,
	previewPositionAtom,
	participantsAtom,
	isTimelineVisibleAtom,
	fragmentTypeAtom,
	openStudioAtom,
	thumbnailAtom,
}
export { View }
export type { ThumbnailProps }
