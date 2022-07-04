import React, { useEffect } from 'react'
import { useRecoilCallback } from 'recoil'
import { FlickFragment } from 'src/graphql/generated'
import {
	activeFragmentIdAtom,
	flickNameAtom,
} from 'src/stores/flick.store'
import Navbar from './core/Navbar'
import SubHeader from './core/SubHeader'

const FlickBody = ({
	flick,
	initialFragmentId,
}: {
	flick: FlickFragment
	initialFragmentId: string | null
}) => {
	const setStoresInitially = useRecoilCallback(
		({ set }) =>
			() => {
				set(flickNameAtom, flick.name)
				set(activeFragmentIdAtom, initialFragmentId)
			},
		[]
	)

	useEffect(() => {
		setStoresInitially()
	}, [setStoresInitially])

	return (
		<div>
			<Navbar />
			<SubHeader />
		</div>
	)
}

export default FlickBody
