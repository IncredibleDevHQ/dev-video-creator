import { css, cx } from '@emotion/css'
import React from 'react'
import { ReactComponent as CommandCode } from '../../../../assets/Command_Code.svg'
import { ReactComponent as CommandHeading1 } from '../../../../assets/Command_Heading1.svg'
import { ReactComponent as CommandHeading2 } from '../../../../assets/Command_Heading2.svg'
import { ReactComponent as CommandHeading3 } from '../../../../assets/Command_Heading3.svg'
import { ReactComponent as CommandImage } from '../../../../assets/Command_Image.svg'
import { ReactComponent as CommandList } from '../../../../assets/Command_List.svg'
import { ReactComponent as CommandText } from '../../../../assets/Command_Text.svg'
import { ReactComponent as CommandVideo } from '../../../../assets/Command_Video.svg'
import { ReactComponent as CommandScreenGrab } from '../../../../assets/Command_ScreenGrab.svg'
import { Text } from '../../../../components'
import { SuggestionItem } from './items'

export type CommandsListState = {
  selectedIndex: number
}

export class CommandsList extends React.Component<any, CommandsListState> {
  constructor(props: any) {
    super(props)
    this.state = {
      selectedIndex: 0,
    }
  }

  onKeyDown({ event }: { event: KeyboardEvent }) {
    if (event.key === 'ArrowUp') {
      this.upHandler()
      return true
    }

    if (event.key === 'ArrowDown') {
      this.downHandler()
      return true
    }

    if (event.key === 'Enter') {
      this.enterHandler()
      return true
    }

    return false
  }

  getIcon = (item: SuggestionItem) => {
    if (item.title === 'H1') return <CommandHeading1 className="p-px" />
    if (item.title === 'H2') return <CommandHeading2 />
    if (item.title === 'H3') return <CommandHeading3 />
    if (item.title === 'Text') return <CommandText />
    if (item.title === 'Code') return <CommandCode />
    if (item.title === 'Image') return <CommandImage />
    if (item.title === 'Video') return <CommandVideo />
    if (item.title === 'List') return <CommandList />
    if (item.title === 'Screengrab') return <CommandScreenGrab />
    return null
  }

  upHandler() {
    this.setState((prev) => ({
      selectedIndex:
        (prev.selectedIndex + this.props.items.length - 1) %
        this.props.items.length,
    }))
  }

  downHandler() {
    this.setState((prev) => ({
      selectedIndex: (prev.selectedIndex + 1) % this.props.items.length,
    }))
  }

  enterHandler() {
    this.selectItem(this.state.selectedIndex)
  }

  selectItem(index: number) {
    const item = this.props.items[index]

    if (item) {
      this.props.command(item)
    }
  }

  render() {
    const items = this.props.items as SuggestionItem[]
    return items.length > 0 ? (
      <div
        className={cx(
          'flex flex-col overflow-y-scroll bg-white border border-gray-200 rounded-sm shadow-md h-80',
          css`
            ::-webkit-scrollbar {
              display: none;
            }
          `
        )}
      >
        {items.map((item, index) => {
          return (
            <div key={item.title} className="flex flex-col px-4">
              {item.type !== items[index - 1]?.type && (
                <Text className="p-2 mt-2 text-xs text-gray-600 font-body">
                  {item.type.toUpperCase()}
                </Text>
              )}
              <button
                type="button"
                className={cx(
                  'px-4 py-1.5 flex items-center justify-between rounded-sm hover:bg-gray-100 focus:outline-none',
                  {
                    'bg-gray-100': index === this.state.selectedIndex,
                    'mb-4': index === items.length - 1,
                  }
                )}
                key={item.title}
                onClick={() => this.selectItem(index)}
              >
                <div className="flex items-center mr-20 gap-x-3">
                  <div className="p-2 bg-gray-800 rounded-sm">
                    {this.getIcon(item)}
                  </div>
                  <div className="flex flex-col items-start gap-y-0">
                    <Text className="text-sm font-bold text-gray-800 font-main">
                      {item.title}
                    </Text>
                    <Text className="-mt-px text-xs text-gray-600 font-body">
                      {item.description}
                    </Text>
                  </div>
                </div>
                {item.shortcut && (
                  <Text className="p-1 text-xs text-red-800 bg-gray-100 border border-gray-300 rounded-sm">
                    {item.shortcut}
                  </Text>
                )}
              </button>
            </div>
          )
        })}
      </div>
    ) : null
  }
}

export default CommandsList
