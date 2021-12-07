import { css, cx } from '@emotion/css'
import React, { useState } from 'react'
import Modal from 'react-responsive-modal'
import {
  Details,
  EditorConfig,
  Format,
  FormatEnum,
  Formats,
  Fragment,
  Integration,
  Interaction,
  Interactions,
  Markdown,
} from '.'
import { Button, Tab, TabBar } from '../../../../components'
import {
  BlogPlatforms,
  PublishablePlatformEnum,
  PublishFlickMutationVariables,
  PublishFormats,
  usePublishFlickMutation,
} from '../../../../generated/graphql'
import { verticalCustomScrollBar } from '../../../../utils/globalStyles'

enum ViewEnum {
  format = 'Format',
  details = 'Details',
  permissions = 'Permissions',
  interactions = 'Interactions',
  copyright = 'Copyright',
  markdown = 'Markdown',
}

interface FlickDetails {
  title: string
  description: string
  thumbnail: string
}

interface MarkdownConfig {
  markdown: string
  integrations: Integration[]
  editorConfig: EditorConfig
}

interface PublishContextProps {
  flickId: string
  tags: string[]
  activeFragments: Fragment[]
  setActiveFragments: (fragments: Fragment[]) => void
  setTags: (tags: string[]) => void
  currentView: Tab
  setCurrentView: (view: Tab) => void
  selectedFormats: Format[]
  setSelectedFormats: (format: Format[]) => void
  isOpenForCollaboration: boolean
  setIsOpenForCollaboration: (isOpen: boolean) => void
  flickDetails: FlickDetails
  setFlickDetails: (details: FlickDetails) => void
  interactions: Interaction[]
  setInteractions: (interactions: Interaction[]) => void
  markdownConfig: MarkdownConfig
  setMarkdownConfig: (markdownConfig: MarkdownConfig) => void
}

const views: Tab[] = [
  {
    name: ViewEnum.format,
    value: ViewEnum.format,
  },
  {
    name: ViewEnum.details,
    value: ViewEnum.details,
  },
  // {
  //   name: ViewEnum.permissions,
  //   value: ViewEnum.permissions,
  // },
  {
    name: ViewEnum.interactions,
    value: ViewEnum.interactions,
  },
  {
    name: ViewEnum.markdown,
    value: ViewEnum.markdown,
  },
]

const initialEditorConfig: EditorConfig = {
  theme: 'vs-light',
  language: 'markdown',
}

export const PublishContext = React.createContext({} as PublishContextProps)

const PublishFlick = ({
  open,
  flickId,
  flickName,
  fragments,
  flickDescription,
  flickThumbnail,
  isAllFlicksCompleted,
  setProcessingFlick,
  setPublished,
  isShortsPresentAndCompleted,
  handleClose,
}: {
  open: boolean
  flickId: string
  flickName?: string
  flickDescription?: string
  flickThumbnail?: string
  fragments: Fragment[]
  isAllFlicksCompleted: boolean
  isShortsPresentAndCompleted: boolean
  setProcessingFlick: (isProcessing: boolean) => void
  setPublished: (published: boolean) => void
  handleClose: () => void
}) => {
  const [flickDetails, setFlickDetails] = useState<FlickDetails>({
    title: flickName || '',
    description: flickDescription || '',
    thumbnail: flickThumbnail || '',
  })
  const [tags, setTags] = useState<string[]>([])
  const [activeFragments, setActiveFragments] = useState<Fragment[]>(fragments)
  const [currentView, setCurrentView] = useState(views[0])
  const [selectedFormats, setSelectedFormats] = useState<Format[]>([])
  const [interactions, setInteractions] = useState<Interaction[]>([])
  const [isOpenForCollaboration, setIsOpenForCollaboration] = useState(false)
  const [markdownConfig, setMarkdownConfig] = useState<MarkdownConfig>({
    markdown: '',
    integrations: [],
    editorConfig: initialEditorConfig,
  })

  const [publishFlick] = usePublishFlickMutation()

  return (
    <PublishContext.Provider
      value={{
        tags,
        setTags,
        flickId,
        currentView,
        setCurrentView,
        activeFragments,
        setActiveFragments,
        selectedFormats,
        setSelectedFormats,
        flickDetails,
        setFlickDetails,
        isOpenForCollaboration,
        setIsOpenForCollaboration,
        interactions,
        setInteractions,
        markdownConfig,
        setMarkdownConfig,
      }}
    >
      <Modal
        open={open}
        onClose={handleClose}
        center
        styles={{
          modal: {
            maxHeight: '90vh',
            height: '100%',
            maxWidth: '40%',
            width: '100%',
          },
        }}
        classNames={{
          modal: cx(
            'rounded-lg overflow-x-hidden',
            verticalCustomScrollBar,
            // {
            //   'w-2/5': currentView.value !== ViewEnum.markdown,
            // },
            css`
              background-color: #fffffff !important;
            `
          ),
          closeButton: css`
            svg {
              fill: #000000;
            }
          `,
        }}
      >
        <TabBar
          tabs={views}
          current={currentView}
          // itemsClassName="text-sm px-1 py-0.5 rounded-sm"
          onTabChange={(tab) => setCurrentView(tab)}
          className="mt-6 mb-4"
        />
        <div>
          {currentView.value === ViewEnum.format && (
            <Formats
              isFlick={isAllFlicksCompleted}
              isShorts={isShortsPresentAndCompleted}
            />
          )}
          {currentView.value === ViewEnum.details && <Details />}
          {/* {currentView.value === ViewEnum.permissions && <Permissions />} */}
          {currentView.value === ViewEnum.interactions && (
            <Interactions fragments={fragments} />
          )}
          {currentView.value === ViewEnum.markdown && <Markdown />}
        </div>
        {currentView.value !== ViewEnum.markdown ? (
          <div className="flex justify-end items-center">
            {currentView.value === ViewEnum.permissions && (
              <Button
                size="small"
                type="button"
                appearance="none"
                className="my-2"
                onClick={() => {
                  let index =
                    views.findIndex((v) => v.value === currentView.value) + 1
                  if (index >= views.length) index = 0
                  setCurrentView(views[index] || currentView)
                }}
              >
                Skip
              </Button>
            )}
            <Button
              size="small"
              type="button"
              appearance="primary"
              className="ml-2 my-2"
              onClick={() => {
                let index =
                  views.findIndex((v) => v.value === currentView.value) + 1
                if (index >= views.length) index = 0
                setCurrentView(views[index] || currentView)
              }}
              disabled={selectedFormats.length < 1}
            >
              Next
            </Button>
          </div>
        ) : (
          <Button
            size="small"
            type="button"
            appearance="primary"
            className="ml-auto my-2"
            onClick={async () => {
              const publishedData: PublishFlickMutationVariables = {
                flickId,
                tags: `{${tags.join(',')}}`,
                interaction: interactions,
                publishToFormats: selectedFormats.map((format) => {
                  if (format.name === FormatEnum.blog)
                    return PublishFormats.Blog
                  if (format.name === FormatEnum.flick)
                    return PublishFormats.Video
                  return PublishFormats.VerticalVideo
                }),
                publishToBlogPlatforms: markdownConfig.integrations.map(
                  (integration) => {
                    if (integration.id === PublishablePlatformEnum.GitHub)
                      return BlogPlatforms.Github
                    if (integration.id === PublishablePlatformEnum.Dev)
                      return BlogPlatforms.Dev
                    return BlogPlatforms.Hashnode
                  }
                ),
                updatedThumbnail: flickDetails.thumbnail,
                updatedTitle: flickDetails.title,
                updatedDescription: flickDetails.description,
              }
              handleClose()
              setProcessingFlick(true)
              await publishFlick({
                variables: publishedData,
              })
              setPublished(true)
            }}
            disabled={selectedFormats.length < 1}
          >
            Publish
          </Button>
        )}
      </Modal>
    </PublishContext.Provider>
  )
}

export default PublishFlick