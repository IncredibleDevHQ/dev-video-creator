import { useRouter } from 'next/router'
import { useEffect } from 'react'
import { useRecoilCallback, useRecoilValue, useSetRecoilState } from 'recoil'
import {
	FlickFragmentFragment,
	useGetFlickFragmentLazyQuery,
} from 'src/graphql/generated'
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
import { Fragment_Type_Enum_Enum } from 'utils/src/graphql/generated'

const FragmentStoreUpdater = () => {
	const { replace, query } = useRouter()

	const flickId = useRecoilValue(flickAtom)?.id
	const setFragmentLoading = useSetRecoilState(fragmentLoadingAtom)

	const setFragmentStores = useRecoilCallback(
		({ set }) =>
			(activeFragment: FlickFragmentFragment) => {
				const ast = activeFragment?.editorState
				set(fragmentsAtom, curr =>
					curr.map(c => (c.id === activeFragment.id ? activeFragment : c))
				)
				set(astAtom, ast ?? null)
				set(thumbnailAtom, activeFragment?.thumbnailConfig ?? null)
				set(
					fragmentTypeAtom,
					activeFragment?.type === Fragment_Type_Enum_Enum.Portrait
						? 'Portrait'
						: 'Landscape'
				)
				set(thumbnailObjectAtom, activeFragment?.thumbnailObject ?? null)
				set(publishConfigAtom, activeFragment?.publishConfig ?? null)

				const tempRecordedBlocks: {
					[key: string]: string
				} = {}
				activeFragment?.blocks?.forEach(b => {
					tempRecordedBlocks[b.id] = b.objectUrl || ''
				})
				set(recordedBlocksAtom, tempRecordedBlocks)
				set(recordingIdAtom, activeFragment.recordings[0].id)
			}
	)

	const [getFragment, { loading }] = useGetFlickFragmentLazyQuery({
		onCompleted(data) {
			if (!data.Fragment_by_pk) return
			setFragmentStores(data.Fragment_by_pk)
		},
	})

	useEffect(() => {
		if (loading) {
			setFragmentLoading(true)
		} else {
			setFragmentLoading(false)
		}
	}, [loading])

	const activeFragmentId = useRecoilValue(activeFragmentIdAtom)
	useEffect(() => {
		if (!activeFragmentId) {
			replace(`/story/${flickId}`, undefined, {
				shallow: true,
			})
			return
		}
		getFragment({
			variables: {
				id: activeFragmentId,
			},
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
