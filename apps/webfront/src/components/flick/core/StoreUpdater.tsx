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
