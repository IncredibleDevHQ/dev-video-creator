import React, { HTMLAttributes } from 'react'
import { FormEvent } from 'react'
import Dropzone from 'react-dropzone'
import { FcOpenedFolder } from 'react-icons/fc'

const FileDropzone = ({
  onChange,

  ...rest
}: HTMLAttributes<HTMLInputElement>) => {
  const onDrop = (acceptedFiles: File[]) => {
    const currentFile = acceptedFiles.map((file) => {
      file.name
    })
    return currentFile
  }
  return (
    <Dropzone
      onDrop={onDrop}
      multiple={true}
      onDropAccepted={(image) => {
        const event = new Event('input', { bubbles: true })
        dispatchEvent(event)
        // @ts-ignore
        event.target.files = image
        onChange!(event as unknown as React.FormEvent<HTMLInputElement>)
      }}
    >
      {({ getRootProps, getInputProps, isDragActive, isDragReject }) => (
        <div
          className="border border-brand-lighter text-center bg-blue-50 border-dashed m-4 p-8 flex flex-col w-60 h-40 justify-center items-center rounded-lg hover:border-brand-darker cursor-pointer text-gray-600"
          {...getRootProps()}
        >
          <FcOpenedFolder size="50px" />
          <input
            {...getInputProps()}
            type="file"
            onChange={onChange}
            {...rest}
          />
          {isDragActive
            ? 'Drop your file here'
            : 'Click me or drag & drop a file here!'}
          {isDragReject && 'File type not accepted, sorry!'}
        </div>
      )}
    </Dropzone>
  )
}

export default FileDropzone
