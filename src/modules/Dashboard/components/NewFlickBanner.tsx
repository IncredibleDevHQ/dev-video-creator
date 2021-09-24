import React from 'react'
import { AiOutlinePlus } from 'react-icons/ai'
import { useHistory } from 'react-router-dom'
import { Button } from '../../../components'

const NewFlickBanner = () => {
  const history = useHistory()

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
  )
}

export default NewFlickBanner
