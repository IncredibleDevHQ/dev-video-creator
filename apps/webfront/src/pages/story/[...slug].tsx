import dynamic from 'next/dynamic'
import Container from 'src/components/core/Container'
import prisma from 'prisma-orm/prisma'
import requireAuth from 'src/utils/helpers/requireAuth'
import { inferQueryOutput } from 'server/trpc'

const FlickBody = dynamic(() => import('src/components/flick'), {
	ssr: false,
})

type FlickProps = {
	fragmentId: string | null
	flick: Omit<inferQueryOutput<'story.byId'>, 'updatedAt' | 'deletedAt'> & {
		updatedAt: string
		deletedAt: string | null
	}
}

const Flick = ({ fragmentId, flick }: FlickProps) => {
	const modFlick = {
		...flick,
		updatedAt: new Date(flick.updatedAt),
		deletedAt: flick.deletedAt ? new Date(flick.deletedAt) : null,
	}
	return (
		<Container title={flick.name}>
			<FlickBody flick={modFlick} initialFragmentId={fragmentId} />
		</Container>
	)
}

export const getServerSideProps = requireAuth(true)(async ({ query, user }) => {
	const id = query.slug?.[0] ?? null
	let fragmentId = query.slug?.[1] ?? null

	if (!id) {
		return {
			notFound: true,
		}
	}

	const flick = await prisma.flick.findFirst({
		where: {
			id,
			Participants: {
				some: {
					userSub: user?.uid,
				},
			},
		},
		select: {
			name: true,
			description: true,
			joinLink: true,
			lobbyPicture: true,
			id: true,
			scope: true,
			md: true,
			dirty: true,
			ownerSub: true,
			updatedAt: true,
			thumbnail: true,
			status: true,
			deletedAt: true,
			producedLink: true,
			useBranding: true,
			brandingId: true,
			configuration: true,
			Content: {
				select: {
					id: true,
					isPublic: true,
					seriesId: true,
					resource: true,
					preview: true,
					thumbnail: true,
					type: true,
				},
			},
			Flick_Series: {
				select: {
					seriesId: true,
				},
			},
			Fragment: {
				select: {
					configuration: true,
					description: true,
					flickId: true,
					id: true,
					name: true,
					order: true,
					type: true,
					producedLink: true,
					producedShortsLink: true,
					editorState: true,
					editorValue: true,
					encodedEditorValue: true,
					thumbnailConfig: true,
					thumbnailObject: true,
					publishConfig: true,
					version: true,
					Blocks: {
						select: {
							id: true,
							objectUrl: true,
							recordingId: true,
							thumbnail: true,
							playbackDuration: true,
						},
					},
				},
			},
			Branding: {
				select: {
					id: true,
					name: true,
					branding: true,
				},
			},
			Theme: {
				select: {
					name: true,
					config: true,
				},
			},
			Participants: {
				select: {
					id: true,
					status: true,
					role: true,
					userSub: true,
					inviteStatus: true,
					User: {
						select: {
							displayName: true,
							picture: true,
							username: true,
							email: true,
							sub: true,
						},
					},
				},
			},
		},
	})

	if (!flick)
		return {
			notFound: true,
		}

	const { Fragment } = flick
	if (Fragment && !fragmentId) {
		fragmentId = Fragment.length > 0 ? Fragment[0].id : null
	}

	const props: FlickProps = {
		fragmentId,
		flick: JSON.parse(JSON.stringify(flick)),
	}

	return {
		props,
	}
})

export default Flick
