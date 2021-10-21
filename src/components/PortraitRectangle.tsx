import React from 'react'

const PortraitRectangle = ({
  height = '24',
  width = '13.5',
  color,
  ...props
}: React.SVGProps<SVGSVGElement>) => (
  <svg
    width={width}
    height={height}
    viewBox="0 0 18 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="0.25"
      y="0.25"
      width="17.5"
      height="31.5"
      fill="white"
      stroke={color}
      strokeWidth="1"
    />
  </svg>
)

export default PortraitRectangle
