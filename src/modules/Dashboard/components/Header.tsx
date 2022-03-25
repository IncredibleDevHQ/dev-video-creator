/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import { cx } from '@emotion/css'
import { Dialog } from '@headlessui/react'
import axios from 'axios'
import { marked } from 'marked'
import React, { useEffect, useRef, useState } from 'react'
import { IconType } from 'react-icons'
import { HiOutlineDownload, HiOutlineSparkles } from 'react-icons/hi'
import { IoAddOutline, IoCopyOutline } from 'react-icons/io5'
import { useHistory } from 'react-router-dom'
import { Button, emitToast, Heading, Loader, Text } from '../../../components'
import {
  CreateFlickFlickScopeEnumEnum,
  useCreateNewFlickMutation,
} from '../../../generated/graphql'
import { logEvent } from '../../../utils/analytics'
import { PageEvent } from '../../../utils/analytics-types'

enum OptionType {
  blank = 'blank',
  local = 'local',
  link = 'link',
}

interface Option {
  icon: IconType
  title: string
  description: string
  type: OptionType
}

const options: Option[] = [
  {
    icon: HiOutlineSparkles,
    title: 'Create blank story',
    description: 'New story with empty markdown',
    type: OptionType.blank,
  },
  {
    icon: HiOutlineDownload,
    title: 'Import local markdown',
    description: 'New story with local markdown',
    type: OptionType.local,
  },
  {
    icon: IoCopyOutline,
    title: 'Paste markdown link',
    description: 'New story with markdown from link',
    type: OptionType.link,
  },
]

const getRawUrl = (from: string) => {
  if (isRawUrl(from)) return from
  // convert github.com to raw.githubusercontent.com for any repository
  const url = from.replace(
    /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.*)$/,
    'https://raw.githubusercontent.com/$1/$2/$3/$4'
  )

  return url
}

const isUrlValid = (url: string) => {
  const urlWithoutTrailingSlash = url.replace(/\/$/, '')

  // check if url is for a markdown file
  const markdownUrlRegex =
    /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.*)\.md$/
  const rawMarkdownUrlRegex =
    /^https:\/\/raw.githubusercontent.com\/.*\/.*\/.*\/.*\.md$/

  return (
    markdownUrlRegex.test(urlWithoutTrailingSlash) ||
    rawMarkdownUrlRegex.test(urlWithoutTrailingSlash)
  )
}

const isRawUrl = (url: string) => {
  const rawMarkdownUrlRegex =
    /^https:\/\/raw.githubusercontent.com\/.*\/.*\/.*\/.*\.md$/
  return rawMarkdownUrlRegex.test(url)
}

const logCreateEvent = (type: OptionType) => {
  switch (type) {
    case OptionType.blank:
      logEvent(PageEvent.CreateBlankStory)
      break
    case OptionType.local:
      logEvent(PageEvent.CreateStoryFromLocalMarkdown)
      break
    case OptionType.link:
      logEvent(PageEvent.CreateStoryFromLink)
      break
    default:
      break
  }
}

const CreateFlickModal = ({
  open,
  handleClose,
  markdownHTML,
  type,
}: {
  open: boolean
  handleClose: () => void
  markdownHTML: string | undefined
  type: OptionType
}) => {
  const history = useHistory()

  const [url, setUrl] = useState('')

  const [createFlick, { data, error }] = useCreateNewFlickMutation()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (type !== OptionType.link)
      if (markdownHTML) {
        createFlick({
          variables: {
            name: 'Untitled',
            scope: CreateFlickFlickScopeEnumEnum.Public,
            md: markdownHTML,
          },
        })
      } else {
        createFlick({
          variables: {
            name: 'Untitled',
            scope: CreateFlickFlickScopeEnumEnum.Public,
          },
        })
      }
  }, [])

  useEffect(() => {
    if (!data) return
    handleClose()
    history.push(`/flick/${data.CreateFlick?.id}`)
  }, [data])

  useEffect(() => {
    if (!error) return
    emitToast({
      autoClose: 3000,
      title: 'Could not create your flick',
      type: 'error',
    })
    handleClose()
  }, [error])

  const handleCreate = async () => {
    try {
      setLoading(true)
      const response = await axios.get(getRawUrl(url))
      const markdown = response.data as string
      const html = marked.parse(markdown, {
        gfm: true,
        smartLists: true,
        smartypants: true,
      })
      await createFlick({
        variables: {
          name: 'Untitled',
          scope: CreateFlickFlickScopeEnumEnum.Public,
          md: html,
        },
      })
    } catch (e) {
      emitToast({
        autoClose: 3000,
        title: 'Could not create your flick',
        type: 'error',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => (type === OptionType.link ? handleClose() : undefined)}
      className={cx(
        'fixed z-50 inset-0 m-auto w-2/5 flex items-center justify-center',
        {
          'w-2/5': type === OptionType.link,
        }
      )}
    >
      <Dialog.Overlay
        onClick={() => {}}
        className="fixed inset-0 bg-black opacity-60"
      />
      {type !== OptionType.link && (
        <div className="flex items-center gap-x-4 bg-dark-200 z-50 p-4 text-white">
          <Loader className="text-brand animate-spin" />
          Creating your flick
        </div>
      )}
      {type === OptionType.link && (
        <div className="flex flex-col gap-y-4 bg-dark-200 p-4 z-50 w-full text-white rounded-sm">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://github.com/user/repo/blob/main/README.md"
            className="w-full bg-dark-400 border border-transparent py-3 px-3 mt-1.5 focus:outline-none text-gray-100 text-sm rounded-sm focus:border-brand"
          />
          {url !== '' && !isUrlValid(url) && (
            <span className="text-xs text-red-500 -mt-2 ml-px">
              Entered URL is not valid
            </span>
          )}
          <Button
            type="button"
            appearance="primary"
            disabled={url === '' || !isUrlValid(url)}
            loading={loading}
            onClick={() => {
              handleCreate()
            }}
          >
            Create
          </Button>
        </div>
      )}
    </Dialog>
  )
}

const Card = ({ description, icon: I, title, type }: Option) => {
  const [openCreate, setOpenCreate] = useState(false)
  const [markdownHTML, setMarkdownHTML] = useState<string>()

  const inputRef = useRef<HTMLInputElement>(null)

  const handleSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const mdHTML = marked.parse(e.target?.result?.toString() || '', {
        gfm: true,
        smartLists: true,
        smartypants: true,
      })
      setMarkdownHTML(mdHTML)
      setOpenCreate(true)
    }
    reader.readAsText(file)
  }

  return (
    <div>
      <div
        className="bg-dark-400 rounded-md flex justify-between items-center p-3 cursor-pointer hover:bg-dark-300 active:bg-dark-200"
        onClick={() => {
          logCreateEvent(type)
          if (type === OptionType.local) {
            inputRef.current?.click()
          } else {
            setOpenCreate(true)
          }
        }}
      >
        <div
          className={cx(`p-2.5 rounded-sm`, {
            'bg-incredible-green-light-600': type === OptionType.blank,
            'bg-incredible-purple-light-600': type === OptionType.local,
            'bg-incredible-blue-light-600': type === OptionType.link,
          })}
        >
          <I
            size={24}
            className={cx({
              'text-incredible-green-600': type === OptionType.blank,
              'text-incredible-purple-600': type === OptionType.local,
              'text-incredible-blue-600': type === OptionType.link,
            })}
          />
        </div>
        <div className="flex-1 mx-4 flex flex-col gap-y-1">
          <Heading fontSize="base">{title}</Heading>
          <Text className="text-dark-title" fontSize="normal">
            {description}
          </Text>
        </div>
        <div className="ml-4">
          <IoAddOutline size={16} className="text-dark-title" />
        </div>
        {type === OptionType.local && (
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            onChange={handleSelectFile}
            accept=".md"
          />
        )}
      </div>
      {openCreate && (
        <CreateFlickModal
          key={type}
          open={openCreate}
          handleClose={() => {
            setOpenCreate(false)
            setMarkdownHTML(undefined)
          }}
          markdownHTML={markdownHTML}
          type={type}
        />
      )}
    </div>
  )
}

const Header = ({ vertical = false }: { vertical?: boolean }) => {
  return (
    <div
      className={cx('flex gap-x-6', {
        'flex-col gap-y-6': vertical,
      })}
    >
      {options.map((option) => (
        <Card key={option.type} {...option} />
      ))}
    </div>
  )
}

export default Header
