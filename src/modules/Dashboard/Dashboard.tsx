import React from 'react'
import { Link } from 'react-router-dom'
import { EmptyState, Navbar } from '../../components'
import { NewFlickBanner } from './components'

const Dashboard = () => {
  return (
    <div>
      <Navbar />
      <EmptyState width={400} text="There's no activity in your feed" />
      <Link to="/flicks">View Upcoming Flicks</Link>
      <NewFlickBanner className="absolute bottom-0" />
    </div>
  )
}

export default Dashboard
