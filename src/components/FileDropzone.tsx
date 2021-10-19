import React, { HTMLAttributes } from 'react'
import Dropzone from 'react-dropzone'
import { BiFileBlank } from 'react-icons/bi'

const FileDropzone = ({
  onChange,
  overrideClassNames,
  className,
  text,
  disabled,
  ...rest
}: HTMLAttributes<HTMLInputElement> & {
  overrideClassNames?: boolean
  text?: string
  disabled?: boolean
}) => {
  const onDrop = (acceptedFiles: File[]) => {
    acceptedFiles.forEach((file) => {
      return file.name
    })
  }
  // Returns a dropzone
  return (
    <Dropzone
      onDrop={onDrop}
      maxFiles={1}
      multiple={false}
      onDropAccepted={(image) => {
        const event = new Event('input', { bubbles: true })
        dispatchEvent(event)
        // @ts-ignore
        event.target.files = image
        onChange?.(event as unknown as React.FormEvent<HTMLInputElement>)
      }}
      disabled={disabled}
    >
      {({ getRootProps, getInputProps, isDragActive, isDragReject }) => (
        <div
          className={
            overrideClassNames
              ? className
              : 'border border-brand-lighter text-center bg-blue-50 border-dashed m-4 p-8 flex flex-col w-60 h-40 justify-center items-center rounded-lg hover:border-brand-darker cursor-pointer text-gray-600'
          }
          {...getRootProps()}
        >
          <BiFileBlank className="mr-1" />
          <input
            {...getInputProps()}
            type="file"
            onChange={onChange}
            {...rest}
          />
          {isDragActive
            ? 'Drop your file here'
            : text || 'Click me or drag & drop a file here!'}
          {isDragReject && 'File type not accepted, sorry!'}
        </div>
      )}
    </Dropzone>
  )
}

export default FileDropzone
