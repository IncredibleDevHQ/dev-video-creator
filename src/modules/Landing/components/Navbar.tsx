import React from 'react'
import { useHistory } from 'react-router-dom'
import { Button } from '../../../components'

const Navbar = () => {
  const history = useHistory()

  return (
    <nav className="flex justify-end items-center">
      <Button
        type="button"
        buttonStyle="default"
        className="mr-4 hover:text-yellow-500"
        onClick={() => history.push('/dashboard')}
      >
        Dashboard
      </Button>
      <Button
        type="button"
        buttonStyle="default"
        className="mr-4 hover:text-yellow-500"
      >
        About Us
      </Button>
      <Button
        type="button"
        buttonStyle="default"
        className="mr-4 hover:text-yellow-500"
      >
        Contact Us
      </Button>
    </nav>
  )
}

export default Navbar
