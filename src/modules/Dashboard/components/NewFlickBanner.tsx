// import { User } from '@sentry/react'
import React from 'react'
import { AiOutlinePlus } from 'react-icons/ai'
import { useHistory } from 'react-router-dom'
// import { useRecoilValue } from 'recoil'
import { Button } from '../../../components'
// import { useGetLatestFlickQuery } from '../../../generated/graphql'
// import { userState } from '../../../stores/user.store'
// import { getRandomGradient } from '../../../utils/globalStyles'

// const randomGradient = getRandomGradient()

const NewFlickBanner = () => {
  const history = useHistory()
  // const { uid } = (useRecoilValue(userState) as User) || {}

  // const { data } = useGetLatestFlickQuery({
  //   variables: {
  //     sub: uid,
  //   },
  // })

  return (
    <div>
      <AiOutlinePlus className="text-white p-2 mx-2" size={20} />
      <Button
        type="button"
        size="extraSmall"
        appearance="primary"
        className="h-10"
        onClick={() => history.push('/new-flick')}
        icon={AiOutlinePlus}
      >
        Create flick
      </Button>
    </div>
    // <div
    //   className={cx(
    //     'flex justify-between items-center py-4 px-8 w-full shadow-md',
    //     {
    //       'text-black': randomGradient.type === 'light',
    //       'text-white': randomGradient.type === 'dark',
    //     },
    //     randomGradient.style,
    //     className
    //   )}
    //   {...rest}
    // >
    //   <div className="flex-1">
    //     <Text fontSize="normal">Create a new flick to get started</Text>
    //   </div>
    //   {data?.Flick[0] ? (
    //     <div className="flex items-center">
    //       <div className="flex flex-col mr-5 text-right">
    //         <span className="text-xl font-bold">Upcoming Flick</span>
    //         <span>{data?.Flick[0].name}</span>
    //         {/* <span>{data?.Flick[0].description}</span> */}
    //       </div>
    //       <div className="flex flex-col">
    //         <Button
    //           type="button"
    //           // buttonStyle={randomGradient.type === 'dark' ? 'light' : 'primary'}
    //           appearance="primary"
    //           className="border-white h-auto"
    //           onClick={() => history.push(`flick/${data.Flick[0].id}`)}
    //         >
    //           Join
    //         </Button>
    //         <button
    //           type="button"
    //           onClick={() => history.push('/new-flick')}
    //           className="text-sm pl-2 pr-2 rounded-md text-white mt-1 bg-purple-600"
    //         >
    //           Or Create New
    //         </button>
    //       </div>
    //     </div>
    //   ) : (

    //   )}
    // </div>
  )
}

export default NewFlickBanner
