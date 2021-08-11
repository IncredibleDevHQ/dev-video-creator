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
    <ul
      className={cx('flex border-b-2 border-background-alt', className)}
      {...rest}
    >
      {tabs.map((tab) => (
        <TabBarItem
          tab={tab}
          key={tab.name}
          current={current === tab}
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
        'cursor-pointer mr-2 text-xs uppercase tracking-wide transition-colors p-2',
        {
          'border-b-2 border-brand text-brand': current,
        }
      )}
      {...rest}
    >
      {tab.name}
    </li>
  )
}

export default TabBar
