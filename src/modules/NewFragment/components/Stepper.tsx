import { cx } from '@emotion/css'
import React from 'react'
import { IconType } from 'react-icons'
import { BiCheck } from 'react-icons/bi'
import { Heading } from '../../../components'

type Step = {
  label: string
  value: string
  icon?: IconType
}

interface StepperProps extends React.HTMLProps<HTMLUListElement> {
  steps: Step[]
  active: number
}

interface StepItemProps extends React.HTMLProps<HTMLLIElement> {
  stepItem: Step
  active?: boolean
  index: number
  last?: boolean
  done?: boolean
  icon?: IconType
}

const StepItem = ({
  className,
  stepItem,
  active,
  index,
  last,
  done,
  icon: I,
  ...rest
}: StepItemProps) => {
  return (
    <li className={cx('flex flex-col', className)} {...rest}>
      <div className="flex items-center">
        {active ? (
          <div className="flex items-center justify-center rounded-full border-gray-400 border-2 text-white w-10 h-10">
            <div className="w-8 h-8 flex items-center justify-center bg-brand rounded-full">
              {I ? (
                <I size={20} />
              ) : (
                <Heading fontSize="medium">{index + 1}</Heading>
              )}
            </div>
          </div>
        ) : done ? (
          <div className="flex items-center justify-center rounded-full text-white bg-green-600 w-10 h-10">
            <BiCheck size={20} />
          </div>
        ) : (
          <div className="w-10 h-10 flex items-center justify-center border-2 text-gray-400 border-gray-400 rounded-full">
            {I ? (
              <I size={20} />
            ) : (
              <Heading fontSize="medium">{index + 1}</Heading>
            )}
          </div>
        )}

        {last ? null : active ? (
          <div className="md:w-36 w-24 mx-3 rounded-lg h-1 bg-brand-10">
            <div className="w-1/2 rounded-lg h-1 bg-brand" />
          </div>
        ) : done ? (
          <div className="md:w-36 w-24 mx-3 rounded-lg h-1 bg-green-600" />
        ) : (
          <div className="md:w-36 w-24 mx-3 rounded-lg h-1 bg-gray-200" />
        )}
      </div>

      <Heading
        fontSize="small"
        className="uppercase tracking-wide font-semibold mt-4 text-gray-400"
      >
        Step {index + 1}
      </Heading>
      <Heading fontSize={'medium'}>{stepItem.label}</Heading>
    </li>
  )
}

const Stepper = ({ className, steps, active, ...rest }: StepperProps) => {
  return (
    <ul className={cx('flex items-center', className)} {...rest}>
      {steps.map((step, index) => (
        <StepItem
          index={index}
          key={index}
          stepItem={step}
          active={active === index}
          last={index === steps.length - 1}
          done={index < active}
          icon={step.icon}
        />
      ))}
    </ul>
  )
}

export default Stepper
