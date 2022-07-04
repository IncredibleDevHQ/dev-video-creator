import axios from 'axios'
import { getAuth } from 'firebase/auth'
import Link from 'next/link'
import { useRouter } from 'next/router'
import {
	CreateFlickFlickScopeEnumEnum,
	useCreateNewFlickMutation,
	useGetDashboardUserFlicksQuery,
} from 'src/graphql/generated'
import requireAuth from 'src/utils/helpers/requireAuth'
import { useUser } from 'src/utils/providers/auth'

const Dashboard = () => {
	const { user } = useUser()
	const { replace, push } = useRouter()

	const handleLogout = async () => {
		await axios.post(
			'/api/logout',
			{},
			{
				withCredentials: true,
			}
		)
		await getAuth().signOut()
		replace('/login')
	}

	const { data, loading } = useGetDashboardUserFlicksQuery({
		variables: {
			sub: user?.uid as string,
			limit: 1000,
		},
	})

	const [createFlick, { loading: creating }] = useCreateNewFlickMutation({
		variables: {
			name: 'Untitled',
			scope: CreateFlickFlickScopeEnumEnum.Public,
		},
		onCompleted: createData => {
			const { id, fragmentId } = createData.CreateFlick || {}
			push(`/story/${id}/${fragmentId}`)
		},
	})

	return (
		<div className='flex flex-col p-4'>
			<nav className='flex items-center justify-between mb-12'>
				<span>
					Dashboard
					<button
						className='border p-1 mx-2'
						type='button'
						disabled={creating}
						onClick={() => createFlick()}
					>
						{creating ? 'Creating' : 'Create story'}
					</button>
				</span>
				<button onClick={handleLogout} className='border p-1' type='button'>
					Logout
				</button>
			</nav>
			{loading && <div>Fetching stories...</div>}
			{data &&
				data.Flick.map(f => (
					<Link href={`/story/${f.id}`} passHref>
						<div className='text-blue-500 cursor-pointer hover:underline flex items-center'>
							{f.name}
						</div>
					</Link>
				))}
		</div>
	)
}

export const getServerSideProps = requireAuth()(async () => ({
	props: {},
}))

export default Dashboard
