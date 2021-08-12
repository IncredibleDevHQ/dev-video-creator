import React, { HTMLProps } from 'react'
import Sidebar from './Sidebar'

const ContainerWithSidebar = ({ children }: HTMLProps<HTMLDivElement>) => {
  return (
    <div className="px-2 py-4 flex min-h-screen">
      <Sidebar />
      <div>{children}</div>
    </div>
  )
}

export default ContainerWithSidebar
