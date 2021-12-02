import { cx } from '@emotion/css'
import React, { useEffect, useState } from 'react'
import { useRecoilState } from 'recoil'
import { Text } from '../../../components'
import { newFlickStore } from '../store/flickNew.store'

enum Splashes {
  Default = '0',
  GraphQL = '1',
  OpenSauced = '2',
  Astro = '3',
  WTFJS = '4',
  Default2 = '5',
}

const IntroConfig = () => {
  const [{ flick, activeFragmentId }, setFlickStore] =
    useRecoilState(newFlickStore)
  const [splash, setSplash] = useState('0')

  useEffect(() => {
    setSplash(
      `${
        flick?.fragments.find((f) => f.id === activeFragmentId)?.configuration
          ?.theme
      }`
    )
  }, [
    flick?.fragments.find((f) => f.id === activeFragmentId)?.configuration
      ?.theme,
  ])

  return (
    <div className="flex-1 h-full p-12">
      <div className="grid grid-cols-3 gap-x-4 gap-y-4">
        {Object.keys(Splashes).map((key, index) => {
          return (
            <button
              onClick={() => {
                setSplash(`${index}`)
                if (flick)
                  setFlickStore((prev) => ({
                    ...prev,
                    flick: {
                      ...flick,
                      fragments: flick.fragments.map((fragment) => {
                        if (fragment.id === activeFragmentId) {
                          return {
                            ...fragment,
                            configuration: {
                              theme: index,
                            },
                          }
                        }
                        return fragment
                      }),
                    },
                  }))
              }}
              className={cx(
                'bg-gray-100 p-10 rounded-md border border-transparent',
                {
                  'border-brand': splash === `${index}`,
                }
              )}
              type="button"
            >
              <Text className="font-bold text-gray-800">{key}</Text>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default IntroConfig
