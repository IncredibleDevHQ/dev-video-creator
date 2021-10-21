import React from 'react'

const LandscapeRectangle = ({
  height = '13.5',
  width = '24',
  color,
  ...props
}: React.SVGProps<SVGSVGElement>) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 32 18"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="0.25"
      y="0.25"
      width="31.5"
      height="17.5"
      fill="white"
      stroke={color}
      strokeWidth="1"
    />
  </svg>
)

export default LandscapeRectangle
