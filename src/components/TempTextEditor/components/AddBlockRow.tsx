import React, { HTMLAttributes } from 'react'
import { BiWindow } from 'react-icons/bi'

const AddBlockRow = ({
  className,
  ...rest
}: HTMLAttributes<HTMLButtonElement>) => {
  return (
    <div className="group my-2">
      <button
        {...rest}
        type="button"
        className="group-hover:opacity-100 opacity-0 border-gray-600 border border-dashed flex items-center text-xs rounded-md px-2 py-1 cursor-pointer text-gray-800 hover:bg-gray-200 transition-all"
      >
        <BiWindow className="mr-1" />
        Add Block
      </button>
    </div>
  )
}
export default AddBlockRow
