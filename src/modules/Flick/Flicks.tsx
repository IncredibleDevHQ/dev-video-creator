import React from 'react'
import { useRecoilValue } from 'recoil'
import { Heading, ScreenState } from '../../components'
import { useGetUserFlicksQuery } from '../../generated/graphql'
import { User, userState } from '../../stores/user.store'
import { FlickCard } from './components'

const Flicks = () => {
  const { uid } = (useRecoilValue(userState) as User) || {}
  const { data, error, loading } = useGetUserFlicksQuery({
    variables: {
      sub: uid || '',
    },
  })

  if (loading) return <ScreenState title="Just a jiffy" loading />

  if (error)
    return (
      <ScreenState title="Something went wrong!!" subtitle={error.message} />
    )

  return (
    <section>
      <Heading fontSize="large" className="mx-8 my-2">
        Your Flicks
      </Heading>
      <div className="p-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-16 gap-y-2">
        {data?.Flick.map((flick) => (
          <FlickCard flick={flick} key={flick.id} />
        ))}
      </div>
    </section>
  )
}

export default Flicks
