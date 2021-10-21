import React, { ChangeEvent, useEffect, useState } from 'react'
import { css, cx } from '@emotion/css'
import Editor from '@monaco-editor/react'
import Modal from 'react-responsive-modal'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { Checkbox, Loading, Button, Text } from '../../../components'
import {
  GenerateMarkdownOutput,
  useGetFlickMarkdownByIdQuery,
  useGenMyMarkdownMutation,
  useUpdateFlickMarkdownMutation,
} from '../../../generated/graphql'

interface EditorConfig {
  theme: string
  language: string
  text: string
}

const initialEditorConfig: EditorConfig = {
  theme: 'vs-dark',
  language: 'markdown',
  text: '# write your markdown here...',
}

const MarkdownModal = ({
  open,
  flickId,
  handleClose,
}: {
  open: boolean
  flickId: string
  handleClose: (refresh?: boolean) => void
}) => {
  const [isCustomMarkdown, setCustomMarkdown] = useState(false)
  const [editorConfig, setEditorConfig] =
    useState<EditorConfig>(initialEditorConfig)
  const [markdownConfig, setMarkdownConfig] = useState<GenerateMarkdownOutput>({
    customMd: '',
    rawMd: '',
    success: false,
  })

  const {
    data,
    loading: getMarkdownLoading,
    refetch,
  } = useGetFlickMarkdownByIdQuery({ variables: { id: flickId } })
  const [updateMarkdownMutation, { loading: updateMarkdownLoading }] =
    useUpdateFlickMarkdownMutation()
  const [generateMarkdownMutation, { loading: generateMarkdownLoading }] =
    useGenMyMarkdownMutation()

  useEffect(() => {
    if (!data?.Flick_by_pk) return
    setMarkdownConfig({
      ...markdownConfig,
      rawMd: data.Flick_by_pk.md || '',
    })
  }, [data])

  useEffect(() => {
    if (isCustomMarkdown) {
      setEditorConfig({
        ...editorConfig,
        text: markdownConfig.customMd,
      })
    } else {
      setEditorConfig({
        ...editorConfig,
        text: markdownConfig.rawMd,
      })
    }
  }, [markdownConfig])

  const generateMarkdown = async () => {
    if (!flickId) return
    const { data } = await generateMarkdownMutation({
      variables: { flickId },
    })
    if (data?.GenerateMarkdown) setMarkdownConfig(data.GenerateMarkdown)
    await refetch?.({ id: flickId })
  }

  const updateMarkdown = async () => {
    if (!flickId) return
    updateMarkdownMutation({
      variables: { id: flickId, md: editorConfig.text },
    })
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        handleClose()
      }}
      center
      classNames={{
        modal: cx(
          'rounded-lg w-auto md:w-2/3',
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
        if (getMarkdownLoading) return <Loading />
        if (!getMarkdownLoading && !markdownConfig.rawMd)
          return (
            <div className="p-4 flex flex-col justify-center items-center">
              <Text>
                You&apos;ve not generated markdown untill now. Click below to
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
            <Checkbox
              name="isCustomMarkdown"
              label="Show Custom markdown"
              checked={isCustomMarkdown}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setCustomMarkdown(e.target.checked)
              }
              className="flex-wrap text-lg py-2"
            />
            <div>
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
              {editorConfig && (
                <Editor
                  value={
                    isCustomMarkdown
                      ? markdownConfig?.customMd
                      : markdownConfig?.rawMd
                  }
                  className="h-72"
                  theme={editorConfig.theme}
                  language={editorConfig.language}
                  options={{
                    readOnly: isCustomMarkdown,
                  }}
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
                  updateMarkdownLoading ||
                  editorConfig.text === markdownConfig.customMd
                }
                onClick={updateMarkdown}
              >
                {updateMarkdownLoading ? 'Loading...' : 'Save'}
              </Button>
              {!isCustomMarkdown && (
                <div>
                  <ReactMarkdown
                    className="prose"
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw]}
                  >
                    {editorConfig.text}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        )
      })()}
    </Modal>
  )
}

export default MarkdownModal
