import { cx } from '@emotion/css'
import React, { useEffect, useState } from 'react'
import { useRecoilState } from 'recoil'
import { Text } from '../../../components'
import { newFlickStore } from '../store/flickNew.store'

enum Splashes {
  GraphQL = '0',
  Astro = '1',
  TensorFlow = '2',
  Default = '3',
  Default2 = '4',
  Default3 = '5',
}

enum Outros {
  Default = '0',
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

export const OutroConfig = () => {
  const [{ flick, activeFragmentId }, setFlickStore] =
    useRecoilState(newFlickStore)
  const [outro, setOutro] = useState('0')

  useEffect(() => {
    setOutro(
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
        {Object.keys(Outros).map((key, index) => {
          return (
            <button
              onClick={() => {
                setOutro(`${index}`)
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
                  'border-brand': outro === `${index}`,
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
