import { cx } from '@emotion/css'
import { nanoid } from 'nanoid'
import React from 'react'
import { ContentEditable } from './ContentEditable'

interface TextboxProps {
  text: string
  handleUpdateText?: (text?: string) => void
  placeholder?: string
  handleKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void
  handleKeyUp?: (e: React.KeyboardEvent<HTMLDivElement>) => void
  className?: string
  tagName?: string
}

const Textbox = React.forwardRef<any, TextboxProps>(
  (
    {
      placeholder,
      handleKeyDown,
      text,
      handleUpdateText,
      handleKeyUp,
      className,
      tagName,
    },
    ref
  ) => {
    return (
      <div className={cx('relative w-full', className)}>
        <ContentEditable
          // @ts-ignore
          innerRef={ref}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          html={text}
          tagName={tagName}
          onChange={(e) => handleUpdateText?.(e.target.value)}
          className="bg-transparent w-full whitespace-pre-wrap inline-block focus:outline-none"
        />
        {text?.length === 0 && placeholder && (
          <span className="absolute left-0 top-0 z-0 pointer-events-none text-gray-400">
            {placeholder}
          </span>
        )}
      </div>
    )
  }
)

export default Textbox
