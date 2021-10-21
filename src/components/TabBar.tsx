import React, { HTMLProps } from 'react'
import { cx } from '@emotion/css'

export interface Tab {
  name: string
  value: string
}

const TabBar = ({
  tabs,
  current,
  onTabChange,
  className,
  ...rest
}: {
  tabs: Tab[]
  current: Tab
  onTabChange: (tab: Tab) => void
} & HTMLProps<HTMLUListElement>) => {
  return (
    <ul className={cx('flex', className)} {...rest}>
      {tabs.map((tab) => (
        <TabBarItem
          tab={tab}
          key={tab.name}
          current={current.value === tab.value}
          onClick={() => onTabChange(tab)}
        />
      ))}
    </ul>
  )
}

const TabBarItem = ({
  current = false,
  tab,
  className,
  ...rest
}: { current: boolean; tab: Tab } & HTMLProps<HTMLLIElement>) => {
  return (
    <li
      className={cx(
        'cursor-pointer px-3 py-2 rounded-md tracking-wide transition-colors text-gray-400 font-semibold',
        {
          'text-gray-800 bg-gray-100': current,
        }
      )}
      {...rest}
    >
      {tab.name}
    </li>
  )
}

export default TabBar
