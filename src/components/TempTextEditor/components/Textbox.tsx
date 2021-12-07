import { cx } from '@emotion/css'
import React from 'react'
import { ContentEditable } from './ContentEditable'

interface TextboxProps {
  text: string
  handleUpdateText?: (text?: string) => void
  placeholder?: string
  handleKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void
  handleKeyUp?: (e: React.KeyboardEvent<HTMLDivElement>) => void
  handleFocus?: (e: React.FormEvent<HTMLDivElement>) => void
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
      handleFocus,
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
          onFocus={handleFocus}
          html={text}
          tagName={tagName}
          onChange={() => {
            // Fix to send sanitized html...
            // @ts-ignore
            handleUpdateText?.(ref?.current?.innerText)
          }}
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
