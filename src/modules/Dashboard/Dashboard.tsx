import React from 'react'
import { Navbar } from '../../components'
import NewFlickBanner from './NewFlickBanner'

const Dashboard = () => {
  return (
    <div className="relative min-h-screen">
      <Navbar />
      <NewFlickBanner className="absolute bottom-0" />
    </div>
  )
}

export default Dashboard
