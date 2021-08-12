import React from 'react'

const NextLineIcon = ({
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
    <path d="M12 8.5V15.5" />
    <path d="M15.5 12L12 15.5L8.5 12" />
  </svg>
)

export default NextLineIcon
