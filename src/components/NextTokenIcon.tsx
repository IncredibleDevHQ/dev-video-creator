import React from 'react'

const NextTokenIcon = ({
  height = '24px',
  width = '24px',
  color,
  ...props
}: React.SVGProps<SVGSVGElement>) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    stroke={color}
    {...props}
  >
    <path d="M16 18L22 12L16 6" />
    <path d="M8 6L2 12L8 18" />
    <path d="M8.5 12H15.5" />
    <path d="M12 8.5L15.5 12L12 15.5" />
  </svg>
)

export default NextTokenIcon
