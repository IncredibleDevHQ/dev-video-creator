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

import { useRouter } from 'next/router'
import { useEffect } from 'react'
import { useRecoilCallback, useRecoilValue, useSetRecoilState } from 'recoil'

import {
	activeFragmentIdAtom,
	astAtom,
	flickAtom,
	fragmentLoadingAtom,
	fragmentsAtom,
	fragmentTypeAtom,
	publishConfigAtom,
	thumbnailAtom,
	thumbnailObjectAtom,
} from 'src/stores/flick.store'
import { recordedBlocksAtom, recordingIdAtom } from 'src/stores/studio.store'
import { FragmentTypeEnum } from 'utils/src/enums'
import trpc, { inferMutationOutput } from '../../../server/trpc'

const FragmentStoreUpdater = () => {
	const { replace, query } = useRouter()

	const flickId = useRecoilValue(flickAtom)?.id
	const setFragmentLoading = useSetRecoilState(fragmentLoadingAtom)

	const setFragmentStores = useRecoilCallback(
		({ set }) =>
			(activeFragment: inferMutationOutput<'fragment.get'>) => {
				const ast = JSON.parse(JSON.stringify(activeFragment?.editorState))
				set(fragmentsAtom, curr =>
					curr.map(c => (c.id === activeFragment.id ? activeFragment : c))
				)
				set(astAtom, ast ?? null)
				set(
					thumbnailAtom,
					JSON.parse(JSON.stringify(activeFragment?.thumbnailConfig)) ?? null
				)
				set(
					fragmentTypeAtom,
					activeFragment?.type === FragmentTypeEnum.Portrait
						? 'Portrait'
						: 'Landscape'
				)
				set(thumbnailObjectAtom, activeFragment?.thumbnailObject ?? null)
				set(
					publishConfigAtom,
					JSON.parse(JSON.stringify(activeFragment?.publishConfig)) ?? null
				)

				const tempRecordedBlocks: {
					[key: string]: string
				} = {}
				activeFragment?.Blocks?.forEach(b => {
					tempRecordedBlocks[b.id] = b.objectUrl || ''
				})
				set(recordedBlocksAtom, tempRecordedBlocks)
				set(recordingIdAtom, activeFragment.Recording[0].id)
				set(fragmentLoadingAtom, false)
			}
	)

	const { mutateAsync: getFragment } = trpc.useMutation(['fragment.get'], {
		onSuccess(data) {
			if (!data) return
			setFragmentStores(data)
		},
	})

	const activeFragmentId = useRecoilValue(activeFragmentIdAtom)
	useEffect(() => {
		if (!activeFragmentId) {
			replace(`/story/${flickId}`, undefined, {
				shallow: true,
			})
			return
		}
		setFragmentLoading(true)
		getFragment({
			id: activeFragmentId,
		})
		const { slug, ...rest } = query
		replace(
			{ pathname: `/story/${flickId}/${activeFragmentId}`, query: rest },
			undefined,
			{
				shallow: true,
			}
		)
	}, [activeFragmentId])

	return null
}

export default FragmentStoreUpdater
