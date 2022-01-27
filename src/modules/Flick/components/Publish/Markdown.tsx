import { css, cx } from '@emotion/css'
import Editor from '@monaco-editor/react'
import React, { useContext, useEffect, useState } from 'react'
import { FaDev, FaGithub } from 'react-icons/fa'
import { SiHashnode } from 'react-icons/si'
import ReactMarkdown from 'react-markdown'
import { useRecoilValue } from 'recoil'
import rehypeRaw from 'rehype-raw'
import remarkGfm from 'remark-gfm'
import { Button, Loading, Text } from '../../../../components'
import { TextEditorParser } from '../../editor/utils/helpers'
import { ASSETS } from '../../../../constants'
import {
  FlickFragment,
  Fragment_Type_Enum_Enum,
  PublishablePlatformEnum,
  useGetFlickMarkdownByIdQuery,
  useMyIntegrationsQuery,
  useUpdateFlickMarkdownMutation,
} from '../../../../generated/graphql'
import { newFlickStore } from '../../store/flickNew.store'
import { PublishContext } from './PublishFlick'

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
    label: 'GitHub',
  },
  {
    id: PublishablePlatformEnum.Hashnode,
    label: 'Hashnode',
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

  const { flick } = useRecoilValue(newFlickStore)

  const { data, loading: getMarkdownLoading } = useGetFlickMarkdownByIdQuery({
    variables: { id: flickId },
  })
  const { data: allowedIntegration, loading: integrationsLoading } =
    useMyIntegrationsQuery()
  const [updateMarkdownMutation, { loading: updateMarkdownLoading }] =
    useUpdateFlickMarkdownMutation()

  useEffect(() => {
    if (!data?.Flick_by_pk) return
    setMarkdownConfig({
      ...markdownConfig,
      markdown: data.Flick_by_pk.md || '',
    })
  }, [data])

  const generateMarkdown = async () => {
    if (!flickId || !flick) return
    const parser = new TextEditorParser()
    const filteredFlick: FlickFragment = {
      ...flick,
      fragments: flick.fragments.filter(
        (f) =>
          f.type !== Fragment_Type_Enum_Enum.Intro &&
          f.type !== Fragment_Type_Enum_Enum.Outro
      ),
    }
    const md = parser.getFlickMarkdown(filteredFlick)
    setMarkdownConfig({
      ...markdownConfig,
      markdown: md,
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

  return (
    <div>
      {(() => {
        if (getMarkdownLoading || integrationsLoading)
          return <Loading className="mx-auto" />
        if (!getMarkdownLoading && !markdownConfig?.markdown)
          return (
            <div className="p-4 flex flex-col justify-center items-center">
              <Text>
                You&apos;ve not generated markdown until now. Click below to
                generate one.
              </Text>
              <Button
                type="button"
                appearance="primary"
                onClick={generateMarkdown}
              >
                Generate
              </Button>
            </div>
          )

        return (
          <div className="min-h-48">
            <Text className="font-body">
              Take a final look at your blog before you publish
            </Text>
            <Text className="mt-4 text-sm font-main">
              Select platform(s) to publish this blog
            </Text>
            <Text className="text-xs font-body">
              You can also publish your blog on your other platforms as well.
              Select the platforms you like.
            </Text>
            <div className="grid grid-flow-col grid-cols-4 gap-x-2 mt-3">
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
                      'flex gap-x-2 justify-start items-center border p-2 rounded-sm my-1',
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
                    <Text className="font-base text-sm">
                      {integration.label}
                    </Text>
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
                          onClick={generateMarkdown}
                        >
                          Regenerate
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
