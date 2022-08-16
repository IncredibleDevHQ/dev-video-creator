import { Text } from 'ui/src'
import { inferQueryOutput } from '../../server/trpc'

const NotificationMessage = ({
	notification,
}: {
	notification: inferQueryOutput<'user.notifications'>['notifications'][number]
}) => {
	const { message } = notification
	const regex = /%(.*?)%/g
	return (
		<Text
			textStyle='body'
			className='text-gray-400'
			dangerouslySetInnerHTML={{
				__html: message.replace(
					regex,
					'<span class="text-gray-100 font-main">$1</span>'
				),
			}}
		/>
	)
}

export default NotificationMessage
