import React, { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useRecoilState } from 'recoil'
import { ScreenState } from '../../components'
import { useGetFlickByIdQuery } from '../../generated/graphql'
import { currentFlickStore } from '../../stores/flick.store'

const Flick = () => {
  const { id } = useParams<{ id: string }>()
  const { data, error, loading } = useGetFlickByIdQuery({ variables: { id } })
  const [flick, setFlick] = useRecoilState(currentFlickStore)

  useEffect(() => {
    if (!data?.Flick_by_pk) return
    setFlick(data.Flick_by_pk)
  }, [data])

  if (loading) return <ScreenState title="Just a jiffy" loading />

  if (error)
    return (
      <ScreenState title="Something went wrong!!" subtitle={error.message} />
    )

  return <section>{flick?.name}</section>
}

export default Flick
