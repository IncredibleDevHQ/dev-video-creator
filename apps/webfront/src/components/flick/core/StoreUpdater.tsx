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
import trpc, { inferMutationOutput } from 'server/trpc'
import { Fragment_Type_Enum_Enum } from 'utils/src/graphql/generated'

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
					activeFragment?.type === Fragment_Type_Enum_Enum.Portrait
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

	const { mutateAsync: getFragment } = trpc.useMutation(
		['fragment.get'],
		{
			onSuccess(data) {
				if (!data) return
				setFragmentStores(data)
			},
		}
	)

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
