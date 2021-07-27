import React from 'react'
import { useRecoilValue } from 'recoil'
import { useGetUserByIdQuery } from '../generated/graphql'
import { userState } from '../stores/user.store'

const Home = () => {
  const user = useRecoilValue(userState)
  const { data } = useGetUserByIdQuery({
    variables: { id: user?.uid as string },
  })

  return <div>Hello, {data?.User_by_pk?.displayName}</div>
}

export default Home
