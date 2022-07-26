import { useRouter } from 'next/router'
import { useEffect } from 'react'
import { useRecoilCallback, useRecoilValue } from 'recoil'
import {
	activeFragmentIdAtom,
	astAtom,
	flickAtom,
	fragmentsAtom,
	fragmentTypeAtom,
	publishConfigAtom,
	thumbnailAtom,
	thumbnailObjectAtom,
} from 'src/stores/flick.store'
import { Fragment_Type_Enum_Enum } from 'utils/src/graphql/generated'

const FragmentStoreUpdater = () => {
	const { replace } = useRouter()

	const fragments = useRecoilValue(fragmentsAtom)
	const flickId = useRecoilValue(flickAtom)?.id

	const setFragmentStores = useRecoilCallback(
		({ set }) =>
			(fragmentId: string) => {
				const activeFragment = fragments.find(
					fragment => fragment.id === fragmentId
				)
				const ast = activeFragment?.editorState
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
		setFragmentStores(activeFragmentId)
		replace(`/story/${flickId}/${activeFragmentId}`, undefined, {
			shallow: true,
		})
	}, [activeFragmentId])

	return null
}

export default FragmentStoreUpdater
