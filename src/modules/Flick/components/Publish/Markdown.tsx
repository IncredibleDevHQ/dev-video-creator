import React, { useContext, useEffect, useState } from 'react'
import { cx, css } from '@emotion/css'
import Editor from '@monaco-editor/react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { FaDev, FaGithub } from 'react-icons/fa'
import { SiHashnode } from 'react-icons/si'
import { Loading, Button, Text, emitToast } from '../../../../components'
import {
  useGetFlickMarkdownByIdQuery,
  useUpdateFlickMarkdownMutation,
  usePublishFlickBlogMutation,
  useMyIntegrationsQuery,
  usePublishBlogsMutation,
  PublishablePlatformEnum,
} from '../../../../generated/graphql'
import { PublishContext } from './PublishFlick'
import { ASSETS } from '../../../../constants'

export interface EditorConfig {
  theme: string
  language: string
}

export interface Integration {
  id: string
  label: string
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

const Markdown = () => {
  const { flickId, markdownConfig, setMarkdownConfig } =
    useContext(PublishContext)
  const [preview, setPreview] = useState(false)

  const { data, loading: getMarkdownLoading } = useGetFlickMarkdownByIdQuery({
    variables: { id: flickId },
  })
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
    setMarkdownConfig({
      ...markdownConfig,
      markdown: data.Flick_by_pk.md || '',
    })
  }, [data])

  const generateMarkdown = async () => {
    if (!flickId) return
    const { data } = await generateMarkdownMutation({
      variables: { flickId },
    })
    if (data?.GenerateBlog)
      setMarkdownConfig({
        ...markdownConfig,
        markdown: data.GenerateBlog.rawMd,
      })
  }

  const updateMarkdown = async () => {
    if (!flickId) return
    updateMarkdownMutation({
      variables: { id: flickId, md: markdownConfig.markdown },
    })
  }

  const handleIntegration = (id: string) => {
    if (
      markdownConfig.integrations.find((integration) => integration.id === id)
    ) {
      setMarkdownConfig({
        ...markdownConfig,
        integrations: markdownConfig.integrations.filter(
          (integration) => integration.id !== id
        ),
      })
    } else {
      const integration = integrations.find((i) => i.id === id)
      if (integration)
        setMarkdownConfig({
          ...markdownConfig,
          integrations: [...markdownConfig.integrations, integration],
        })
    }
  }

  const publish = async () => {
    try {
      await publishBlog({
        variables: {
          flickId,
          platforms: markdownConfig.integrations.map(
            (i) => i.id
          ) as PublishablePlatformEnum[],
        },
      })
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
    <div>
      {(() => {
        if (getMarkdownLoading || integrationsLoading)
          return <Loading className="mx-auto" />
        if (!getMarkdownLoading && !markdownConfig.markdown)
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
            <Text className="mt-2">
              Select platform(s) to publish this blog
            </Text>
            <div className="grid grid-flow-col grid-cols-4 gap-x-2">
              {integrations.map((integration) => {
                const isSelected = !!markdownConfig.integrations.find(
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
                      'flex justify-start items-center border p-1 rounded-md my-1',
                      {
                        'border-brand': isSelected,
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
                            <FaGithub size={20} className="mr-1 text-black" />
                          )
                        case PublishablePlatformEnum.Hashnode:
                          return (
                            <SiHashnode
                              size={20}
                              className={cx(
                                'mr-1',
                                css`
                                  fill: #2962ff;
                                `
                              )}
                            />
                          )
                        case PublishablePlatformEnum.Dev:
                          return <FaDev size={20} className="mr-1 text-black" />
                        default:
                          return null
                      }
                    })()}
                    <Text fontSize="small">{integration.label}</Text>
                  </div>
                )
              })}
            </div>
            <div className="flex flex-col">
              <div className="ml-auto flex justify-end items-baseline rounded-sm overflow-hidden my-1">
                <div
                  role="button"
                  tabIndex={0}
                  onKeyDown={() => null}
                  className={cx('p-1', {
                    'bg-gray-100': preview,
                    'bg-gray-200': !preview,
                  })}
                  onClick={() => setPreview(false)}
                >
                  <img
                    className="w-5 h-5"
                    src={ASSETS.ICONS.PENCIL_ALT}
                    alt="edit"
                  />
                </div>
                <div
                  role="button"
                  tabIndex={0}
                  onKeyDown={() => null}
                  className={cx('p-1', {
                    'bg-gray-100': !preview,
                    'bg-gray-200': preview,
                  })}
                  onClick={() => setPreview(true)}
                >
                  <img
                    className="w-5 h-5"
                    src={ASSETS.ICONS.EYE_OUTLINE}
                    alt="preview"
                  />
                </div>
              </div>
              <div>
                {preview ? (
                  <ReactMarkdown
                    className="prose shadow-sm rounded-md px-1 py-2 min-h-48"
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw]}
                  >
                    {markdownConfig.markdown}
                  </ReactMarkdown>
                ) : (
                  markdownConfig.editorConfig && (
                    <>
                      <Editor
                        value={markdownConfig.markdown}
                        className="h-72 w-full shadow-sm"
                        theme={markdownConfig.editorConfig.theme}
                        language={markdownConfig.editorConfig.language}
                        options={{
                          minimap: {
                            enabled: false,
                          },
                        }}
                        onChange={(e) =>
                          e &&
                          setMarkdownConfig({
                            ...markdownConfig,
                            markdown: e,
                          })
                        }
                      />
                      <div className="flex justify-start items-center">
                        <Button
                          type="button"
                          appearance="secondary"
                          size="extraSmall"
                          className="my-1"
                          disabled={generateMarkdownLoading}
                          onClick={generateMarkdown}
                        >
                          {generateMarkdownLoading
                            ? 'Loading...'
                            : 'Regenerate'}
                        </Button>
                        <Button
                          type="button"
                          appearance="secondary"
                          className="ml-2 my-1"
                          size="extraSmall"
                          disabled={updateMarkdownLoading}
                          onClick={updateMarkdown}
                        >
                          {updateMarkdownLoading ? 'Loading...' : 'Save'}
                        </Button>
                      </div>
                    </>
                  )
                )}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

export default Markdown
