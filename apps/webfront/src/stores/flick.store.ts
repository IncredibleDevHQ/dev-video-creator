import { SimpleAST } from 'editor/src/utils/types'
import { atom } from 'recoil'

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

/* This atom stores the ast */
const astAtom = atom<SimpleAST | null>({
	key: 'ast',
	default: null,
})

export { flickNameAtom, activeFragmentIdAtom, viewAtom, astAtom }
export { View }
