/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import { css, cx } from '@emotion/css'
import React, { useState } from 'react'
import { FiClock } from 'react-icons/fi'
import Modal from 'react-responsive-modal'
import { Heading, Text, Button } from '../../../components'

const allowedTimes = [2, 5, 10, 15, 20, 30, 40, 50, 60]

const TimerModal = ({
  open,
  timeLimit,
  handleClose,
  setTimeLimit,
}: {
  open?: boolean
  timeLimit?: number
  setTimeLimit: (time: number | undefined) => void
  handleClose: () => void
}) => {
  const [selectedTime, setSelectedTime] = useState(timeLimit)

  return (
    <Modal
      open={open || false}
      onClose={handleClose}
      center
      classNames={{
        modal: cx(
          'rounded-lg mx-auto p-4 text-white',
          css`
            background-color: #27272a !important;
          `
        ),
      }}
      showCloseIcon={false}
    >
      <div className="flex flex-col items-center justify-center p-4 w-min">
        <Heading fontSize="medium" className="flex items-center">
          <FiClock className="mr-2" /> Set time limit
        </Heading>
        <Text fontSize="normal" className="text-center my-2 font-body">
          Specify how many minutes you want to talk to see a warning when you’re
          about to reach the limit. You can continue to record even after.
        </Text>
        <div className="flex items-center justify-between w-full px-4 py-2 bg-dark-400 rounded-sm mt-2">
          <span>{selectedTime}</span>
          <span>min</span>
        </div>
        <div className="flex items-start flex-wrap my-1 w-max">
          {allowedTimes.map((time, index) => (
            <span
              className={cx(
                'rounded-sm px-2 py-1 text-xs border cursor-pointer font-body',
                {
                  'bg-brand-grey text-dark-title border-transparent':
                    time !== selectedTime,
                  'bg-brand-10 text-brand border-brand': time === selectedTime,
                  'm-1': index !== 0,
                  'ml-0 m-1': index === 0,
                  'mr-0 m-1': index === allowedTimes.length - 1,
                }
              )}
              onClick={() => setSelectedTime(time)}
              key={time}
            >
              {time}min
            </span>
          ))}
        </div>
        <Button
          appearance="primary"
          type="button"
          className="w-full mt-4"
          onClick={() => {
            setTimeLimit(selectedTime)
            handleClose()
          }}
        >
          Set limit
        </Button>
        <Button
          appearance="gray"
          type="button"
          className="w-full mt-2"
          onClick={() => {
            setTimeLimit(undefined)
            handleClose()
          }}
        >
          Continue without limit
        </Button>
      </div>
    </Modal>
  )
}

export default TimerModal
