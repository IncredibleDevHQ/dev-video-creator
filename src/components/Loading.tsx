import React from 'react'

const Loading = ({
  children,
  className,
}: {
  children: string
  className: string
}) => {
  return <div className={className}>{children}</div>
}

export default Loading
