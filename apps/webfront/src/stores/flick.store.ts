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

import { Block, SimpleAST } from 'editor/src/utils/types'
import { atom, DefaultValue, selector } from 'recoil'
import { IntroBlockViewProps, Layout } from 'utils/src'
import { inferQueryOutput } from '../server/trpc'

/* Stores some basic flick details */
const flickAtom = atom<{
	id: string
	owner: {
		id: string
		sub: string
	}
	joinLink: string
	contents: inferQueryOutput<'story.byId'>['Content']
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
const participantsAtom = atom<inferQueryOutput<'story.byId'>['Participants']>({
	key: 'participants',
	default: [],
})

/* This atom stores the currently selected format */
const activeFragmentIdAtom = atom<string | null>({
	key: 'activeFragmentId',
	default: null,
})

/* This atom stores if the current atom is being fetched */
const fragmentLoadingAtom = atom<boolean>({
	key: 'fragmentLoading',
	default: false,
})

/* This atom stores the list of fragments */
const fragmentsAtom = atom<inferQueryOutput<'story.byId'>['Fragment']>({
	key: 'fragments',
	default: [],
})

const activeFragmentSelector = selector<
	inferQueryOutput<'story.byId'>['Fragment'][number] | undefined
>({
	key: 'activeFragment',
	get: ({ get }) => {
		const activeFragmentId = get(activeFragmentIdAtom)
		const fragments = get(fragmentsAtom)
		return fragments.find(fragment => fragment.id === activeFragmentId)
	},
	set: ({ get, set }, newValue) => {
		if (newValue instanceof DefaultValue || newValue === undefined) return
		const fragments = get(fragmentsAtom)

		const newFragments = fragments.map(fragment =>
			fragment.id === newValue.id ? newValue : fragment
		)
		set(fragmentsAtom, newFragments)
	},
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

const thumbnailObjectAtom = atom<string | null>({
	key: 'thumbnailObject',
	default: null,
})

export interface CallToAction {
	seconds: number
	text?: string
	url?: string
}
export interface IPublish {
	title?: string
	description?: string
	thumbnail?: {
		objectId?: string
		method: 'generated' | 'uploaded'
	}
	ctas: CallToAction[]
	discordCTA?: { url: string; text: string }
}
const publishConfigAtom = atom<IPublish | null>({
	key: 'publishConfig',
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
	thumbnailObjectAtom,
	publishConfigAtom,
	fragmentsAtom,
	activeFragmentSelector,
	fragmentLoadingAtom,
}
export { View }
export type { ThumbnailProps }
