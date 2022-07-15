import {
	PresencePage,
	useMyPresence,
	useOthers,
	Presence,
} from 'src/utils/liveblocks.config'
import { Avatar } from 'ui/src'

const PresenceAvatars = () => {
	// getting the presence of others from live blocks
	const [myPresence] = useMyPresence()
	const others = useOthers()
	return (
		<>
			<Avatar
				src={myPresence.user.picture}
				name={myPresence.user.name}
				alt={myPresence.user.name}
				className='h-7 w-7 rounded-full'
			/>
			{others?.map(({ presence }) => {
				if (presence) {
					const otherPresence = presence as Presence
					return otherPresence.page === PresencePage.Recording ||
						otherPresence.page === PresencePage.Backstage ? (
						<Avatar
							src={otherPresence.user.picture}
							name={otherPresence.user.name}
							className='h-7 w-7 rounded-full'
							alt={otherPresence.user.name}
						/>
					) : null
				}
				return null
			})}
		</>
	)
}
export default PresenceAvatars
