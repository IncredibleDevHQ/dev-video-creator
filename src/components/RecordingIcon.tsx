import { cx } from '@emotion/css'
import React, { HTMLAttributes } from 'react'
import { FiCheckCircle } from 'react-icons/fi'

type RecordingStatus = 'notRecording' | 'recording' | 'done'

const RecordingIcon = ({
  className,
  status,
  ...rest
}: { status: RecordingStatus } & HTMLAttributes<HTMLButtonElement>) => {
  return status === 'done' ? (
    <button type="button" {...rest}>
      <FiCheckCircle className={className} />
    </button>
  ) : (
    <button
      type="button"
      className={cx(
        'flex justify-center items-center rounded-full',
        {
          'border-2 border-error': status === 'recording',
          'bg-error': status === 'notRecording',
        },
        className
      )}
      {...rest}
    >
      {status === 'recording' && <div className={cx('w-2 h-2 bg-error')} />}
    </button>
  )
}

export default RecordingIcon
