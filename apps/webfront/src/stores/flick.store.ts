import { Block, SimpleAST } from 'editor/src/utils/types'
import { atom, DefaultValue, selector } from 'recoil'

/* Stores name of the flick */
const flickNameAtom = atom<string | null>({
	key: 'flickName',
	default: null,
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

export {
	flickNameAtom,
	activeFragmentIdAtom,
	viewAtom,
	astAtom,
	currentBlockIdAtom,
	currentBlockSelector,
	isTimelineVisibleAtom,
}
export { View }
