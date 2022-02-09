import { css, cx } from '@emotion/css'
import { Menu } from '@headlessui/react'
import { Font, FontManager, OPTIONS_DEFAULTS } from '@samuelmeuli/font-manager'
import React, { useEffect, useState } from 'react'
import { BiCheck } from 'react-icons/bi'
import { IoChevronDownOutline, IoChevronUpOutline } from 'react-icons/io5'
import { Button, Text } from '../../../components'
import config from '../../../config'
import { loadFonts } from '../../Studio/hooks/use-load-font'

export interface IFont {
  family: string
  type: 'google' | 'custom'
  url?: string
}

const initialFonts: IFont[] = [
  {
    family: 'Gilroy',
    type: 'custom',
  },
  {
    family: 'Inter',
    type: 'custom',
  },
]

const CustomFontPicker = ({
  activeFont,
  onChange,
  customFonts,
  showUploadFont,
}: {
  activeFont: IFont
  onChange: (font: IFont) => void
  customFonts: IFont[]
  showUploadFont: () => void
}) => {
  const [fonts, setFonts] = useState<IFont[]>(initialFonts)

  useEffect(() => {
    loadFonts(
      customFonts.map((font) => {
        return {
          family: font.family,
          type: font.type,
          url: font.url,
          weights: ['400'],
        }
      })
    )
    const newFonts = [...fonts, ...customFonts].sort((a, b) =>
      a.family.localeCompare(b.family)
    )
    setFonts(
      newFonts.filter(
        (font, index, self) =>
          self.findIndex((t) => t.family === font.family) === index
      )
    )
  }, [customFonts])

  const getFonts = () => {
    const fontManager = new FontManager(
      config.googleFonts.apiKey,
      '',
      {
        ...OPTIONS_DEFAULTS,
        limit: 50,
      },
      () => {}
    )
    fontManager
      .init()
      .then(() => {
        const list = fontManager.getFonts()
        const fList: IFont[] = []
        list.forEach((font: Font) => {
          fList.push({
            family: font.family,
            type: 'google',
            url: `https://fonts.googleapis.com/css?family=${font.family}`,
          } as IFont)
        })
        setFonts(
          [...fList, initialFonts[0]]
            .filter((f) => f.family !== '')
            .sort((a, b) => a.family.localeCompare(b.family))
        )
      })
      .catch(() => {
        // eslint-disable-next-line no-console
        console.error('Failed to load google fonts')
      })
  }

  useEffect(() => {
    getFonts()
  }, [])

  return (
    <Menu>
      {({ open }) => (
        <div className="relative mt-1">
          <Menu.Button
            className={cx(
              'w-full flex gap-x-4 text-left items-center justify-between border border-transparent rounded-sm bg-gray-100 shadow-sm py-1.5 px-3 pr-8 relative',
              {
                'border-brand': open,
              }
            )}
          >
            <Text
              className={cx(
                'text-sm block truncate text-gray-800',
                css`
                  font-family: ${activeFont.family};
                `
              )}
            >
              {activeFont.family}
            </Text>
            <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none text-gray-600 ">
              {open ? <IoChevronUpOutline /> : <IoChevronDownOutline />}
            </span>
          </Menu.Button>
          <div className="absolute w-full rounded-md z-50 bg-dark-300 mt-2 ">
            <Menu.Items>
              <Menu.Items
                className={cx(
                  'h-52 overflow-y-scroll bg-dark-300 rounded-t-md w-full',
                  css`
                    ::-webkit-scrollbar {
                      display: none;
                    }
                  `
                )}
              >
                {fonts.map((font, index) => (
                  <Menu.Item key={font.family} onClick={() => onChange(font)}>
                    {({ active }) => (
                      <div
                        className={cx(
                          'flex items-center gap-x-4 py-2 px-3 pr-8 relative text-left font-body text-gray-100 cursor-pointer',
                          {
                            'bg-dark-100': active,
                            'rounded-t-md pt-3': index === 0,
                          }
                        )}
                      >
                        <Text
                          className={cx(
                            'text-sm block truncate',
                            css`
                              font-family: ${font.family};
                            `
                          )}
                        >
                          {font.family}
                        </Text>
                        {activeFont.family === font.family && (
                          <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                            <BiCheck size={20} />
                          </span>
                        )}
                      </div>
                    )}
                  </Menu.Item>
                ))}
              </Menu.Items>
              {open && (
                <Menu.Item
                  onClick={() => {
                    showUploadFont()
                  }}
                >
                  <div className="border-t border-gray-600 px-3 pb-1  rounded-b-md bg-dark-300">
                    <Button
                      appearance="gray"
                      type="button"
                      className="flex my-3 w-full"
                    >
                      <Text className="text-sm">Add new</Text>
                    </Button>
                  </div>
                </Menu.Item>
              )}
            </Menu.Items>
          </div>
        </div>
      )}
    </Menu>
  )
}

export default CustomFontPicker
