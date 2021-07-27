import React, { useEffect } from 'react'
import { useRecoilValue } from 'recoil'
import { useGetUserByIdQuery } from '../generated/graphql'
import { userState } from '../stores/user.store'

const Home = () => {
  const user = useRecoilValue(userState)
  const { data } = useGetUserByIdQuery({
    variables: { id: user?.uid as string },
  })

  useEffect(() => {
    console.log(data?.User_by_pk)
  }, [data])

  return <div>Hello</div>
}

export default Home
