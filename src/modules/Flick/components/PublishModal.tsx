import React, { useEffect, useState } from 'react'
import { css, cx } from '@emotion/css'
import Editor from '@monaco-editor/react'
import Modal from 'react-responsive-modal'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { FiGithub } from 'react-icons/fi'
import { SiDevdotto, SiHashnode } from 'react-icons/si'
import { Loading, Button, Text, Heading, emitToast } from '../../../components'
import {
  useGetFlickMarkdownByIdQuery,
  useUpdateFlickMarkdownMutation,
  usePublishFlickBlogMutation,
  useMyIntegrationsQuery,
  usePublishBlogsMutation,
  PublishablePlatformEnum,
} from '../../../generated/graphql'

interface EditorConfig {
  theme: string
  language: string
  text: string
}

interface Integration {
  id: string
  label: string
}

const initialEditorConfig: EditorConfig = {
  theme: 'vs-dark',
  language: 'markdown',
  text: '# write your markdown here...',
}

const integrations: Integration[] = [
  {
    id: PublishablePlatformEnum.GitHub,
    label: 'Github',
  },
  {
    id: PublishablePlatformEnum.Hashnode,
    label: 'HashNode',
  },
  {
    id: PublishablePlatformEnum.Dev,
    label: 'Dev',
  },
]

const PublishModal = ({
  open,
  flickId,
  handleClose,
}: {
  open: boolean
  flickId: string
  handleClose: () => void
}) => {
  const [editorConfig, setEditorConfig] =
    useState<EditorConfig>(initialEditorConfig)
  const [markdown, setMarkdown] = useState<string>()
  const [selectedIntegrations, setSelectedIntegrations] = useState<
    Integration[]
  >([])

  const {
    data,
    loading: getMarkdownLoading,
    refetch,
  } = useGetFlickMarkdownByIdQuery({ variables: { id: flickId } })
  const { data: allowedIntegration, loading: integrationsLoading } =
    useMyIntegrationsQuery()
  const [updateMarkdownMutation, { loading: updateMarkdownLoading }] =
    useUpdateFlickMarkdownMutation()
  const [generateMarkdownMutation, { loading: generateMarkdownLoading }] =
    usePublishFlickBlogMutation()
  const [publishBlog, { loading: publishBlogLoading }] =
    usePublishBlogsMutation()

  useEffect(() => {
    if (!data?.Flick_by_pk) return
    setMarkdown(data.Flick_by_pk.md || '')
  }, [data])

  useEffect(() => {
    if (!markdown) return
    setEditorConfig({
      ...editorConfig,
      text: markdown,
    })
  }, [markdown])

  const generateMarkdown = async () => {
    if (!flickId) return
    const { data } = await generateMarkdownMutation({
      variables: { flickId },
    })
    if (data?.GenerateBlog) setMarkdown(data.GenerateBlog.rawMd)
  }

  const updateMarkdown = async () => {
    if (!flickId) return
    updateMarkdownMutation({
      variables: { id: flickId, md: editorConfig.text },
    })
  }

  const handleIntegration = (id: string) => {
    if (selectedIntegrations.find((integration) => integration.id === id)) {
      setSelectedIntegrations(selectedIntegrations.filter((i) => i.id !== id))
    } else {
      const integration = integrations.find((i) => i.id === id)
      if (integration)
        setSelectedIntegrations([...selectedIntegrations, integration])
    }
  }

  const publish = async () => {
    try {
      await publishBlog({
        variables: {
          flickId,
          platforms: selectedIntegrations.map(
            (i) => i.id
          ) as PublishablePlatformEnum[],
        },
      })
      handleClose()
      emitToast({
        type: 'success',
        title: 'Wohoo!',
        description: 'Blog published successfully',
      })
    } catch (error: any) {
      console.error(error)
      emitToast({
        title: 'Something went wrong!',
        description: error?.message || '',
        type: 'error',
      })
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      center
      classNames={{
        modal: cx(
          'rounded-lg w-auto md:w-2/3 overflow-x-hidden',
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
      {(() => {
        if (getMarkdownLoading || integrationsLoading) return <Loading />
        if (!getMarkdownLoading && !markdown)
          return (
            <div className="p-4 flex flex-col justify-center items-center">
              <Text>
                You&apos;ve not generated markdown until now. Click below to
                generate one.
              </Text>
              <Button
                type="button"
                appearance="primary"
                disabled={generateMarkdownLoading}
                onClick={generateMarkdown}
              >
                {generateMarkdownLoading ? 'Loading...' : 'Generate'}
              </Button>
            </div>
          )

        return (
          <div className="min-h-48">
            <Heading fontSize="medium">Publish to</Heading>
            <Text className="mt-3">
              Select platform(s) to publish this blog
            </Text>
            <div className="grid grid-flow-col grid-cols-3 gap-x-2">
              {integrations.map((integration) => {
                const isSelected = !!selectedIntegrations.find(
                  (i) => i.id === integration.id
                )
                const exists =
                  !!allowedIntegration?.MyIntegrations?.integrations?.[
                    integration.id.toLowerCase()
                  ]?.exists

                return (
                  <div
                    role="button"
                    tabIndex={0}
                    className={cx(
                      'flex justify-start items-center shadow-md p-2 rounded-md my-2',
                      {
                        'border border-brand': isSelected,
                        'cursor-pointer': exists,
                        'cursor-not-allowed opacity-70': !exists,
                      }
                    )}
                    key={integration.id}
                    onKeyDown={() => {}}
                    onClick={() => {
                      if (exists) handleIntegration(integration.id)
                    }}
                  >
                    {(() => {
                      switch (integration.id) {
                        case PublishablePlatformEnum.GitHub:
                          return (
                            <FiGithub
                              size={24}
                              className={cx('mr-2', {
                                'text-brand': isSelected,
                              })}
                            />
                          )
                        case PublishablePlatformEnum.Hashnode:
                          return (
                            <SiHashnode
                              size={24}
                              className={cx('mr-2', {
                                'text-brand': isSelected,
                              })}
                            />
                          )
                        case PublishablePlatformEnum.Dev:
                          return (
                            <SiDevdotto
                              size={24}
                              className={cx('mr-2', {
                                'text-brand': isSelected,
                              })}
                            />
                          )
                        default:
                          return null
                      }
                    })()}
                    <Text
                      fontSize="normal"
                      className={cx('font-semibold', {
                        'text-brand': isSelected,
                      })}
                    >
                      {integration.label}
                    </Text>
                  </div>
                )
              })}
            </div>
            <div>
              <div className="flex items-baseline">
                <Text>Review Your generated Markdown</Text>
                <Button
                  type="button"
                  appearance="secondary"
                  size="extraSmall"
                  className="ml-auto my-1"
                  disabled={generateMarkdownLoading}
                  onClick={generateMarkdown}
                >
                  {generateMarkdownLoading ? 'Loading...' : 'Regenerate'}
                </Button>
              </div>
              {editorConfig && (
                <Editor
                  value={markdown}
                  className="h-72"
                  theme={editorConfig.theme}
                  language={editorConfig.language}
                  onChange={(e) =>
                    e &&
                    setEditorConfig({
                      ...editorConfig,
                      text: e,
                    })
                  }
                />
              )}
              <Button
                type="button"
                appearance="secondary"
                className="ml-auto my-1"
                size="extraSmall"
                disabled={
                  updateMarkdownLoading || editorConfig.text === markdown
                }
                onClick={updateMarkdown}
              >
                {updateMarkdownLoading ? 'Loading...' : 'Save'}
              </Button>
              <div>
                <Text>Here's a Preview of your Markdown</Text>
                <ReactMarkdown
                  className="prose"
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeRaw]}
                >
                  {editorConfig.text}
                </ReactMarkdown>
              </div>
            </div>
            <Button
              type="button"
              appearance="primary"
              className="ml-auto my-1"
              size="small"
              disabled={
                !markdown ||
                markdown.length < 1 ||
                selectedIntegrations.length < 1
              }
              onClick={publish}
            >
              {publishBlogLoading ? 'Loading...' : 'Publish'}
            </Button>
          </div>
        )
      })()}
    </Modal>
  )
}

export default PublishModal
