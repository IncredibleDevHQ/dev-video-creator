import { cx } from '@emotion/css'
import React, { useState } from 'react'
import { Navbar } from '../Dashboard/components'
import { customScroll } from '../Dashboard/Dashboard'
import Preferences from './components/Preferences'
import ProfileSettings from './components/ProfileSettings'

interface Tab {
  id: string
  name: string
}

const tabs: Tab[] = [
  { id: 'Profile', name: 'Profile settings' },
  //   { id: 'Integrations', name: 'Integrations' },
  { id: 'Preferences', name: 'Preferences' },
]

const Settings = () => {
  const [currentTabId, setCurrentTabId] = useState<string>(tabs[0].id)

  return (
    <div className="flex flex-col h-screen">
      <Navbar />
      <div className="bg-dark-500 flex-1 overflow-hidden grid grid-cols-10">
        <div className="flex flex-col items-start pt-12 pl-20 col-span-2 gap-y-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={cx('border-l border-transparent text-sm px-2', {
                'border-brand text-white': tab.id === currentTabId,
                'text-dark-title': tab.id !== currentTabId,
              })}
              onClick={() => setCurrentTabId(tab.id)}
            >
              {tab.name}
            </button>
          ))}
        </div>
        <div
          className={cx(
            'col-span-8 pt-12 pl-6 text-white overflow-y-auto',
            customScroll
          )}
        >
          {currentTabId === 'Profile' && <ProfileSettings />}
          {/* {currentTabId === 'Integrations' && <Integrations />} */}
          {currentTabId === 'Preferences' && <Preferences />}
        </div>
      </div>
    </div>
  )
}

export default Settings
