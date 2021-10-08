import React from 'react'

const SwapIcon = ({
  height = '24px',
  width = '24px',
  color,
  ...props
}: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={width}
    height={height}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="feather feather-code"
  >
    <path
      d="M6.36754 6.47583H5.90274V3.00679M6.36754 6.47583C6.89938 5.1631 7.85151 4.06379 9.07487 3.35C10.2982 2.6362 11.7237 2.34821 13.1283 2.53113C14.5328 2.71404 15.837 3.35753 16.8367 4.36085C17.361 4.88705 17.7861 5.49663 18.0974 6.16011M6.36754 6.47583H9.0044"
      stroke="#5256E1"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M17.6325 17.532H18.0973V21.001M17.6325 17.532C17.1006 18.8447 16.1485 19.944 14.9251 20.6578C13.7018 21.3716 12.2763 21.6596 10.8717 21.4767C9.46723 21.2938 8.16302 20.6503 7.16329 19.647C6.63897 19.1208 6.21393 18.5112 5.90259 17.8477M17.6325 17.532H14.9956"
      stroke="#5256E1"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <rect x="2.5" y="9.50391" width="7" height="5" rx="0.5" stroke="#5256E1" />
    <rect
      x="14.52"
      y="9.50391"
      width="7"
      height="5"
      rx="0.5"
      stroke="#5256E1"
    />
  </svg>
)

export default SwapIcon
