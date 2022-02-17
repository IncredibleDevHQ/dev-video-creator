import React from 'react'
import Navbar from './components/Navbar'

const Dashboard = () => {
  return (
    <div>
      <Navbar />
      <div className="grid grid-flow-col">
        <div className="col-span-2">hi</div>
        <div className="col-span-8">hi2</div>
      </div>
    </div>
  )
}

export default Dashboard
