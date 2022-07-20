import dynamic from 'next/dynamic'
import { useEffect } from 'react'
import Container from 'src/components/core/Container'
import { FlickFragment } from 'src/graphql/generated'
import requireAuth from 'src/utils/helpers/requireAuth'
import useReplace from 'src/utils/hooks/useReplace'
import sdk from 'src/utils/sdk'

const FlickBody = dynamic(() => import('src/components/flick'), {
	ssr: false,
})

type FlickProps = {
	id: string
	fragmentId: string | null
	flick: FlickFragment
}

const Flick = ({ id, fragmentId, flick }: FlickProps) => {
	const replace = useReplace()

	useEffect(() => {
		replace(`/story/${id}/${fragmentId}`, undefined, {
			shallow: true,
		})
	}, [replace, fragmentId, id])

	return (
		<Container title={flick.name}>
			<FlickBody flick={flick} initialFragmentId={fragmentId} />
		</Container>
	)
}

export const getServerSideProps = requireAuth()(async ({ query }) => {
	const id = query.slug?.[0] ?? null
	let fragmentId = query.slug?.[1] ?? null

	if (!id) {
		return {
			notFound: true,
		}
	}

	const response = await sdk.GetFlickById({
		id,
	})
	const flick = response.data.Flick_by_pk
	if (!flick)
		return {
			notFound: true,
		}

	const { fragments } = flick
	if (fragments) {
		fragmentId = fragments.length > 0 ? fragments[0].id : null
	}
	const props: FlickProps = {
		id,
		fragmentId,
		flick,
	}
	return {
		props,
	}
})

export default Flick
