/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import { css, cx } from '@emotion/css'
import { GiphyFetch } from '@giphy/js-fetch-api'
import { Grid } from '@giphy/react-components'
import { Node, nodeInputRule } from '@tiptap/core'
import {
  mergeAttributes,
  NodeViewWrapper,
  ReactNodeViewRenderer,
} from '@tiptap/react'
import React, { useEffect, useRef, useState } from 'react'
import { buildStyles, CircularProgressbar } from 'react-circular-progressbar'
import Dropzone from 'react-dropzone'
import { FaUnsplash } from 'react-icons/fa'
import {
  IoCloudUploadOutline,
  IoImageOutline,
  IoReloadOutline,
  IoSearchOutline,
} from 'react-icons/io5'
import { SiGiphy } from 'react-icons/si'
import StackGrid from 'react-stack-grid'
import { useDebouncedCallback } from 'use-debounce'
import { ReactComponent as AppLogo } from '../../../../assets/new_logo.svg'
import { emitToast, Text, Tooltip } from '../../../../components'
import config from '../../../../config'
import { useGetImagesFromUnsplashLazyQuery } from '../../../../generated/graphql'
import { useUploadFile } from '../../../../hooks'
import { AllowedFileExtensions } from '../../../../hooks/use-upload-file'
import { uploadImagePlugin } from '../utils/upload_image'

const gf = new GiphyFetch(config.giphy.apiKey)

const noScrollbar = css`
  ::-webkit-scrollbar {
    display: none;
  }
`

const incredibleGifs = [
  'API.gif',
  'Active-user.gif',
  'Backend.gif',
  'Coding-day-and-night.gif',
  'Coding-day-night.gif',
  'Confused.gif',
  'Data-analytics.gif',
  'Data-stream.gif',
  'Fast-performance.gif',
  'Front-End.gif',
  'Graph-curve.gif',
  'Github.gif',
  'Launch.gif',
  'Link.gif',
  'Link_2.gif',
  'Link_3.gif',
  'Logging.gif',
  'Logging_2.gif',
  'New-User.gif',
  'Processing.gif',
  'Processing_2.gif',
  'Pulse.gif',
  'Resurrected-user.gif',
  'Route.gif',
  'Route---Portrait.gif',
  'Runtime-1.gif',
  'Settings.gif',
  'Settings_2.gif',
  'Success.gif',
  'Video-Call.gif',
]

interface ImageOptions {
  inline: boolean
  HTMLAttributes: Record<string, any>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    image: {
      /**
       * Add an image
       */
      setImage: (options: {
        src: string
        alt?: string
        title?: string
      }) => ReturnType
    }
  }
}

const IMAGE_INPUT_REGEX = /!\[(.+|:?)\]\((\S+)(?:(?:\s+)["'](\S+)["'])?\)/

export default Node.create<ImageOptions>({
  name: 'image',

  addOptions() {
    return {
      ...this.parent?.(),
      inline: false,
      HTMLAttributes: {},
    }
  },

  inline() {
    return this.options.inline
  },

  group() {
    return this.options.inline ? 'inline' : 'block'
  },

  addAttributes() {
    return {
      src: {
        default: null,
      },
      localSrc: {
        default: null,
      },
      alt: {
        default: null,
      },
      title: {
        default: null,
      },
      caption: {
        default: null,
      },
    }
  },
  parseHTML: () => [
    {
      tag: 'img[src]',
      getAttrs: (dom) => {
        if (typeof dom === 'string') return {}
        const element = dom as HTMLImageElement

        const obj = {
          src: element.getAttribute('src'),
          title: element.getAttribute('title'),
          alt: element.getAttribute('alt'),
        }
        return obj
      },
    },
  ],
  renderHTML: ({ HTMLAttributes }) => ['img', mergeAttributes(HTMLAttributes)],

  addNodeView() {
    return ReactNodeViewRenderer(Image)
  },

  addCommands() {
    return {
      setImage:
        (attrs) =>
        ({ state, dispatch }) => {
          const { selection } = state
          const position = selection.$head
            ? selection.$head.pos
            : selection.$to.pos

          const node = this.type.create(attrs)
          const transaction = state.tr.insert(position - 1, node)
          return dispatch?.(transaction)
        },
    }
  },
  addInputRules() {
    return [
      nodeInputRule({
        find: IMAGE_INPUT_REGEX,
        type: this.type,
        getAttributes: (match) => {
          const [, alt, src, title] = match
          return {
            src,
            alt,
            title,
          }
        },
      }),
    ]
  },
  addProseMirrorPlugins() {
    return [uploadImagePlugin()]
  },
})

const Image = (props: any) => {
  const { src, alt, title, localSrc, caption } = props.node.attrs
  const [upload] = useUploadFile()
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)

  const uploadMedia = async (files: File[]) => {
    try {
      setLoading(true)
      const file = files?.[0]
      if (!file) throw new Error('No file selected')
      setMedia(file)
      const { uuid } = await upload({
        file,
        extension: file.name.split('.').pop() as AllowedFileExtensions,
        handleProgress: ({ percentage }) => {
          setProgress(percentage)
        },
      })
      props.updateAttributes({
        src: `${config.storage.baseUrl}${uuid}`,
      })
      setLoading(false)
      setProgress(0)
    } catch (error: any) {
      setLoading(false)
      setProgress(0)
      emitToast({
        type: 'error',
        title: 'Failed to upload thumbnail',
        description: error.message,
        autoClose: 500,
      })
    }
  }

  const setMedia = (file: File) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (readerEvent) => {
      props.updateAttributes({
        localSrc: readerEvent.target?.result as string,
      })
    }
  }

  const [isInputOpen, setInputOpen] = useState(false)

  return (
    <NodeViewWrapper as="div" id={props.node.attrs.id}>
      {src && (
        <div contentEditable={false} className="group">
          <img
            className="cursor-pointer w-full group-hover:bg-gray-100 border border-transparent group-hover:border-gray-200 rounded-t-md"
            src={localSrc || src}
            alt={alt}
            title={title}
          />
          <input
            value={caption}
            placeholder="Write a caption..."
            className="border border-gray-200 border-r-0 border-l-0 w-full group-hover:bg-gray-100 group-hover:border-r group-hover:border-l font-body px-2 py-1 focus:outline-none placeholder-italic text-black"
            onChange={(e) => {
              props.updateAttributes({ caption: e.target.value })
            }}
          />
        </div>
      )}

      {loading && (
        <div className="relative">
          {localSrc && <img src={localSrc} alt="img" />}
          <div className="absolute bottom-4 right-4 flex items-center justify-between px-1.5 rounded-sm gap-x-2 bg-black bg-opacity-60 w-20">
            <div className="w-4 h-4">
              <CircularProgressbar
                styles={buildStyles({
                  rotation: 0.25,
                  strokeLinecap: 'round',
                  textSize: '12px',
                  pathColor: `rgba(22, 163, 74, ${progress / 100})`,
                  textColor: '#f88',
                  trailColor: '#fafafa',
                })}
                value={progress}
              />
            </div>
            <Text
              className={cx(
                css`
                  color: #fefefe !important;
                  font-size: 0.875rem !important;
                  line-height: 1.25rem !important;
                  margin: 3px !important;
                `
              )}
              contentEditable={false}
            >
              {progress}%
            </Text>
          </div>
        </div>
      )}

      {!src && !loading && (
        <Tooltip
          isOpen={isInputOpen}
          setIsOpen={setInputOpen}
          placement="bottom-start"
          content={<ImageInput uploadMedia={uploadMedia} props={props} />}
        >
          <button
            type="button"
            className="w-full bg-gray-100 rounded-sm flex items-center px-4 py-3 gap-x-2 text-gray-400 hover:bg-gray-200 cursor-pointer hover:text-gray-500 active:bg-gray-300 transition-all"
            onClick={() => setInputOpen(true)}
          >
            <IoImageOutline />
            <span className="font-body">Add image</span>
          </button>
        </Tooltip>
      )}
    </NodeViewWrapper>
  )
}

const tabs = [
  {
    id: 'Upload',
    name: 'Upload',
  },
  {
    id: 'IncredibleGIFS',
    name: 'Incredible GIFS',
    icon: AppLogo,
  },
  {
    id: 'GIPHY',
    name: 'GIPHY',
    icon: SiGiphy,
  },
  {
    id: 'Unsplash',
    name: 'Unsplash',
    icon: FaUnsplash,
  },
]

const ImageInput = ({
  uploadMedia,
  props,
}: {
  uploadMedia: (files: File[]) => Promise<void>
  props: any
}) => {
  const [activeTabId, setActiveTabId] = useState(tabs[0].id)

  return (
    <div
      style={{
        width: '525px',
      }}
      className="bg-white border shadow-sm py-4 px-5 rounded-sm -mt-3"
    >
      <div className="flex gap-x-6 mb-4">
        {tabs.map((tab) => (
          <span
            onClick={() => setActiveTabId(tab.id)}
            className={cx(
              'text-sm text-gray-400 flex items-center gap-x-1.5 cursor-pointer transition-all font-bold',
              {
                'text-gray-800': tab.id === activeTabId,
              }
            )}
          >
            {tab.icon && (
              <tab.icon
                className={cx('w-3 h-3 filter grayscale', {
                  'brightness-0': tab.id === activeTabId,
                })}
              />
            )}
            {tab.name}
          </span>
        ))}
      </div>
      {activeTabId === tabs[0].id && (
        <Dropzone onDrop={uploadMedia} accept="image/*" maxFiles={1}>
          {({ getRootProps, getInputProps }) => (
            <div
              tabIndex={-1}
              onKeyUp={() => {}}
              role="button"
              className="flex flex-col items-center p-4 border border-gray-200 border-dashed rounded-md cursor-pointer"
              {...getRootProps()}
            >
              <input {...getInputProps()} />
              <IoCloudUploadOutline size={21} className="mb-2 text-gray-600" />

              <div className="z-50 text-center text-gray-600 flex flex-col justify-center text-xs gap-y-1">
                <span className="font-body">Drag and drop or</span>
                <span className="font-semibold text-gray-800">browse</span>
              </div>
            </div>
          )}
        </Dropzone>
      )}
      {activeTabId === tabs[1].id && <IncredibleGifs props={props} />}
      {activeTabId === tabs[2].id && <GiphyTab props={props} />}
      {activeTabId === tabs[3].id && <UnsplashTab props={props} />}
    </div>
  )
}

const GiphyTab = ({ props }: { props: any }) => {
  const [search, setSearch] = useState<string | undefined>('')

  useEffect(() => {
    setSearch(undefined)
  }, [])

  const fetchGifs = (offset: number) =>
    search ? gf.search(search, { offset }) : gf.trending({ offset })

  const divRef = useRef<HTMLDivElement>(null)

  return (
    <div
      ref={divRef}
      className="flex flex-col"
      style={{
        height: '300px',
      }}
    >
      <div className="flex items-center w-full rounded-sm gap-x-2 bg-gray-100">
        <IoSearchOutline size={18} className="ml-3 text-gray-400" />
        <input
          value={search}
          className="w-full py-1.5 pr-3 placeholder-gray-400 focus:outline-none font-body text-sm bg-gray-100 rounded-sm"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setSearch(e.target.value)
          }
          placeholder="Search"
        />
      </div>
      <Grid
        className={cx('mt-4 overflow-y-scroll', noScrollbar)}
        key={search}
        columns={3}
        onGifClick={(gif, e) => {
          e.preventDefault()
          props.updateAttributes({
            localSrc: `https://i.giphy.com/media/${gif.id}/giphy.gif`,
            src: `https://i.giphy.com/media/${gif.id}/giphy.gif`,
          })
        }}
        width={divRef.current?.clientWidth || 0}
        fetchGifs={fetchGifs}
        borderRadius={0}
        gutter={10}
      />
    </div>
  )
}

const UnsplashTab = ({ props }: { props: any }) => {
  const [search, setSearch] = useState('enjoy')

  const gridRef = useRef<StackGrid>(null)
  const [getImages, { data, error, refetch }] =
    useGetImagesFromUnsplashLazyQuery()

  const debounced = useDebouncedCallback(() => {
    getImages({
      variables: {
        query: search,
      },
    })
  }, 1000)

  useEffect(() => {
    debounced()
  }, [search])

  const divRef = useRef<HTMLDivElement>(null)

  return error ? (
    <div className="flex flex-col items-center justify-center w-full mt-8">
      <IoReloadOutline className="text-gray-400" />
      <Text
        className="text-sm text-blue-700 cursor-pointer hover:underline"
        onClick={() => refetch?.()}
      >
        Retry
      </Text>
    </div>
  ) : (
    <div
      ref={divRef}
      className="flex flex-col"
      style={{
        height: '300px',
      }}
    >
      <div className="flex items-center w-full rounded-sm gap-x-2 bg-gray-100">
        <IoSearchOutline size={18} className="ml-3 text-gray-400" />
        <input
          className="w-full py-1.5 pr-3 placeholder-gray-400 focus:outline-none font-body text-sm bg-gray-100 rounded-sm"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setSearch(e.target.value)
          }
          placeholder="Search"
        />
      </div>

      <StackGrid
        ref={gridRef}
        className={cx('mt-4 overflow-scroll -ml-px', noScrollbar)}
        columnWidth={153}
        gutterHeight={10}
        gutterWidth={10}
        monitorImagesLoaded
        duration={0}
      >
        {data &&
          data.SearchUnsplash &&
          data.SearchUnsplash.results.map((r: any) => {
            return (
              <img
                src={r.urls.thumb}
                alt={r.alt_description || ''}
                className="object-cover h-full cursor-pointer"
                onClick={() => {
                  props.updateAttributes({
                    localSrc: r.urls.small,
                    src: r.urls.full,
                  })
                }}
              />
            )
          })}
      </StackGrid>
    </div>
  )
}

const IncredibleGifs = ({ props }: { props: any }) => {
  return (
    <div
      className="flex flex-col"
      style={{
        height: '300px',
      }}
    >
      <StackGrid
        className={cx(' overflow-scroll -ml-px', noScrollbar)}
        columnWidth={153}
        gutterHeight={10}
        gutterWidth={10}
        monitorImagesLoaded
        appearDelay={100}
        duration={0}
      >
        {incredibleGifs.map((gif) => {
          return (
            <img
              src={`https://cdn-staging.incredible.dev/gifs/${gif}`}
              alt={gif}
              className="object-cover h-full cursor-pointer border"
              onClick={() => {
                props.updateAttributes({
                  localSrc: `https://cdn-staging.incredible.dev/gifs/${gif}`,
                  src: `https://cdn-staging.incredible.dev/gifs/${gif}`,
                })
              }}
            />
          )
        })}
      </StackGrid>
    </div>
  )
}
