import React, { ChangeEvent, useEffect, useRef, useState } from 'react'
import Editor, { useMonaco } from '@monaco-editor/react'
import axios from 'axios'
import Select from 'react-select'
import { FiCode, FiTrash } from 'react-icons/fi'
import { nanoid } from 'nanoid'
import { cx } from '@emotion/css'
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from 'react-beautiful-dnd'
import {
  Heading,
  TextField,
  Button,
  emitToast,
  TabBar,
  Text,
  Checkbox,
} from '../../../../components'
import { API } from '../../../../constants'
import { useGetCodeExplanationMutation } from '../../../../generated/graphql'
import { GetSchemaElementProps } from '../Effects'

interface EditorConfig {
  theme: string
  language: string
  text: string
}

interface GistFile {
  content: string
  filename: string
  language: string
  raw_url: string
  size: number
  truncated: boolean
  type: string
}

interface MonacoLanguage {
  aliases: string[]
  extensions: string[]
  id: string
  mimetypes?: string[]
  loader?: () => any
}

interface Subtext {
  id: string
  explanation: string
  from: number
  to: number
}

const editorOptions = {
  readOnly: false,
}

const initialEditorConfig: EditorConfig = {
  theme: 'vs-dark',
  language: 'plaintext',
  text: '// write your code here...',
}

const initialSubtext: Subtext = {
  id: '',
  explanation: '',
  from: 0,
  to: 0,
}

const validGist = (value: string) => {
  const gistExp1 = RegExp('.*?gist.github.com\\/([\\w-]+)\\/([\\w-]+)')
  const gistExp2 = RegExp(
    '.*?gist.(github|githubusercontent).com\\/([\\w-]+)\\/([\\w-]+)'
  )
  return gistExp1.test(value) || gistExp2.test(value)
}

const reorder = (list: any[], startIndex: number, endIndex: number) => {
  const results = Array.from(list)
  const [removed] = results.splice(startIndex, 1)
  results.splice(endIndex, 0, removed)

  return results.map((result, index) => ({ ...result, order: index }))
}

const CodeEditor = ({
  schema,
  handleChange,
  value,
  setConfigured,
}: GetSchemaElementProps) => {
  const [gistURL, setGistURL] = useState('')
  const [isAutomated, setAutomated] = useState(false)
  const [files, setFiles] = useState<GistFile[]>([])
  const [selectedFile, setSelectedFile] = useState<GistFile>()
  const [languages, setLanguages] = useState<MonacoLanguage[]>()
  const [selectedLanguage, setSelectedLanguage] = useState<MonacoLanguage>()
  const [editorConfig, setEditorConfig] =
    useState<EditorConfig>(initialEditorConfig)
  const [subtext, setSubtext] = useState<Subtext>(initialSubtext)
  const [subtexts, setSubtexts] = useState<Subtext[]>([])
  const [selectedCode, setSelectedCode] = useState<string>()
  const [codeExplanations, setCodeExplanations] = useState<string>('')

  const editorRef = useRef<any>(null)
  const monaco = useMonaco()

  const [getCodeExplanationMutation, { loading: explanationLoading }] =
    useGetCodeExplanationMutation()

  useEffect(() => {
    console.log({ editorConfig })
  }, [editorConfig])

  useEffect(() => {
    if (!monaco) return
    const allLanguages = monaco.languages.getLanguages()
    setSelectedLanguage(allLanguages[0])
    setLanguages(allLanguages)

    // eslint-disable-next-line consistent-return
    return () => {
      resetGist()
    }
  }, [monaco])

  useEffect(() => {
    if (!files || files.length < 1) return
    setSelectedFile(files[0])
  }, [files])

  useEffect(() => {
    if (!selectedFile) return

    setEditorConfig({
      ...editorConfig,
      text: selectedFile.content,
      language: selectedFile.language,
    })

    if (!languages) return
    setSelectedLanguage(
      languages.find((l) => l.id === selectedFile.language.toLowerCase())
    )
  }, [selectedFile])

  useEffect(() => {
    if (!selectedLanguage) return
    setEditorConfig({
      ...editorConfig,
      language: selectedLanguage.id,
    })
  }, [selectedLanguage])

  useEffect(() => {
    if (!languages) return
    if (!value) {
      setConfigured(false)
    }
    setSubtexts(value?.explanation || [])
    setGistURL(value?.gistURL || '')
    setEditorConfig({
      ...editorConfig,
      text: value?.code || '',
    })
    setSelectedLanguage(languages?.find((l) => l.id === value?.language))
    setAutomated(value?.isAutomated || false)
  }, [value, languages])

  const handleOnDatachange = (schemaValue: any, value: any) => {
    if (schemaValue !== value) {
      setConfigured(false)
    } else {
      setConfigured(true)
    }
  }

  const addToFormik = (valueArray: any) => {
    const event = new Event('input', { bubbles: true })
    dispatchEvent(event)
    // @ts-ignore
    event.target.name = schema.key
    // @ts-ignore
    event.target.value = valueArray
    handleChange(event as any)
    handleOnDatachange(schema.value, valueArray)
  }

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return
    const items = reorder(
      subtexts,
      result.source.index,
      result.destination.index
    )
    setSubtexts(items)
  }

  useEffect(() => {
    if (!editorRef.current) return
    editorRef.current.onDidChangeModelContent(() => {
      setEditorConfig({
        ...editorConfig,
        language: selectedLanguage?.id || languages?.[0].id || 'plaintext',
        text: editorRef.current.getValue(),
      })
    })
    editorRef.current.onDidChangeCursorSelection((e: any) => {
      const tempSubtext = { ...subtext }
      setSelectedCode(
        editorRef.current
          .getModel()
          .getValueInRange(editorRef.current.getSelection())
      )
      tempSubtext.from = e.selection.startLineNumber
      tempSubtext.to = e.selection.endLineNumber
      setSubtext(tempSubtext)
    })
  }, [editorRef.current, selectedLanguage, languages])

  const addSubtext = () => {
    const tempSubtext = { ...subtext }
    tempSubtext.id = nanoid()
    setSubtexts([...subtexts, tempSubtext])
    setSelectedCode('')
    setSubtext(initialSubtext)
  }

  const resetGist = () => {
    setGistURL('')
    setFiles([])
    setSelectedFile(undefined)
    setSelectedLanguage(languages?.[0])
    setEditorConfig(initialEditorConfig)
  }

  const deleteSubtext = (id: string) => {
    setSubtexts(subtexts.filter((subtext) => subtext.id !== id))
  }

  const getCodeExplanation = async () => {
    const { data } = await getCodeExplanationMutation({
      variables: { code: editorConfig.text },
    })

    if (data?.ExplainCode?.description)
      setCodeExplanations(data.ExplainCode.description)
  }

  const parseCodeForGist = async () => {
    try {
      if (!validGist(gistURL)) throw new Error('Invalid Gist URL')
      const gistId = gistURL.split('/').pop()
      const {
        data: { files },
      } = await axios.get(`${API.GITHUB.BASE_URL}gists/${gistId}`)
      setFiles([...Object.keys(files).map((key) => files[key])])
    } catch (error: any) {
      emitToast({
        title: 'Please try again.',
        description: `Failed to load code for the given gist. ${error?.message}`,
        type: 'error',
      })
      console.error(error)
    }
  }

  return (
    <div className="px-4">
      <Checkbox
        name="isAutomated"
        label="Automate this codejam"
        checked={isAutomated}
        onChange={(e: ChangeEvent<HTMLInputElement>) =>
          setAutomated(e.target.checked)
        }
        className="flex-wrap text-lg py-2"
      />
      <TextField
        label="Add Gist URL to parse code or write code directly"
        value={gistURL}
        className="mt-2"
        onChange={(e: ChangeEvent<HTMLInputElement>) =>
          setGistURL(e.target.value)
        }
      />
      <div className="flex justify-end items-center my-1">
        <Button
          type="button"
          appearance="secondary"
          size="small"
          className="mr-2"
          onClick={resetGist}
        >
          Reset
        </Button>
        <Button
          type="button"
          appearance="primary"
          size="small"
          onClick={parseCodeForGist}
        >
          Get Code
        </Button>
      </div>
      <div className="flex justify-between flex-wrap items-center">
        {files && selectedFile && (
          <TabBar
            className="flex-1"
            tabs={files.map((file) => {
              return {
                name: file.filename,
                value: file.raw_url,
              }
            })}
            current={{
              name: selectedFile.filename,
              value: selectedFile.raw_url,
            }}
            onTabChange={(tab) =>
              setSelectedFile(
                files.find((file) => file.raw_url === tab.value) || files[0]
              )
            }
          />
        )}
        {languages && (
          <Select
            className="flex-1"
            value={{
              label: selectedLanguage?.aliases[0],
              value: selectedLanguage?.id,
            }}
            isSearchable={false}
            options={languages.map((lang: any) => {
              return {
                label: lang.aliases[0],
                value: lang.id,
              }
            })}
            onChange={(e) => {
              if (e && e.value) {
                const getLanguage = languages.find((l) => l.id === e.value)
                console.log({ getLanguage })
                setSelectedLanguage(getLanguage)
              }
            }}
          />
        )}
      </div>
      <div className="relative flex justify-between items-start w-full">
        <div
          className={cx('w-9/12', {
            'w-full': !isAutomated,
          })}
        >
          {editorConfig && (
            <Editor
              className="h-72 my-2"
              options={editorOptions}
              value={editorConfig.text}
              theme={editorConfig.theme}
              language={editorConfig.language.toLowerCase()}
              onMount={(editor: EditorConfig) => {
                editorRef.current = editor
              }}
            />
          )}
        </div>
        {isAutomated && (
          <div className="pl-2 pt-2 pb-2 flex flex-col justify-start items-center w-full">
            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="droppable">
                {(provided) => (
                  <div
                    className="w-full"
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                  >
                    {subtexts.map((text, index) => (
                      <Draggable
                        draggableId={text.id}
                        key={text.id}
                        index={index}
                      >
                        {(provided, snapshot) => (
                          <div
                            key={text.id}
                            className={cx('bg-gray-200 p-1 rounded-md my-1', {
                              'border border-brand': snapshot.isDragging,
                            })}
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                          >
                            <div className="flex justify-between">
                              <div className="flex justify-start">
                                <FiCode className="mr-1 text-brand" />
                                <Text
                                  className="text-brand"
                                  fontSize="small"
                                >{`Line ${text.from} - Line ${text.to}`}</Text>
                              </div>
                              <FiTrash
                                className="text-sm text-error cursor-pointer"
                                onClick={() => deleteSubtext(text.id)}
                              />
                            </div>
                            <Text fontSize="small">{text.explanation}</Text>
                          </div>
                        )}
                      </Draggable>
                    ))}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
            <div>
              <div className="bg-white p-1 rounded-md mb-2">
                {selectedCode ? (
                  <>
                    <div className="flex justify-between">
                      <Heading fontSize="extra-small" className="underline">
                        Selected Text
                      </Heading>
                      <div className="flex justify-end">
                        <FiCode className="mr-1 text-brand" />
                        <Text
                          className="text-brand"
                          fontSize="small"
                        >{`Line ${subtext.from} - Line ${subtext.to}`}</Text>
                      </div>
                    </div>
                    <Text
                      fontSize="small"
                      className="whitespace-pre-wrap leading-3 font-mono"
                    >
                      {selectedCode}
                    </Text>
                  </>
                ) : (
                  <Text fontSize="small" className="w-full">
                    Please select a block of code to add...
                  </Text>
                )}
              </div>
              <TextField
                label="Add Note (optional)"
                value={subtext.explanation}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setSubtext({ ...subtext, explanation: e.target.value })
                }
              />
              <Button
                type="button"
                appearance="secondary"
                size="small"
                className="ml-auto"
                onClick={addSubtext}
                disabled={!subtext.explanation}
              >
                Add
              </Button>
            </div>
          </div>
        )}
      </div>
      {isAutomated && (
        <div className="flex justify-center items-center p-4 my-2 bg-gray-200 rounded-md">
          {codeExplanations.length > 0 ? (
            <div className="relative w-full">
              <Button
                type="button"
                appearance="secondary"
                size="small"
                className="absolute top-1 right-1"
                onClick={getCodeExplanation}
                disabled={!editorConfig.text || explanationLoading}
              >
                {explanationLoading ? 'loading...' : 'Regenerate'}
              </Button>
              <Text className="w-full mt-12 whitespace-pre-wrap">
                {codeExplanations}
              </Text>
            </div>
          ) : (
            <div>
              {editorConfig.text ? (
                <Button
                  type="button"
                  appearance="primary"
                  size="small"
                  className="ml-2"
                  onClick={getCodeExplanation}
                  disabled={!editorConfig.text || explanationLoading}
                >
                  {explanationLoading ? 'loading...' : 'Get Explanation'}
                </Button>
              ) : (
                <Text>Please write some code to get the explanation</Text>
              )}
            </div>
          )}
        </div>
      )}
      <Button
        type="button"
        appearance="primary"
        size="small"
        className="ml-auto"
        onClick={() => {
          addToFormik({
            code: editorConfig.text,
            gistURL,
            language: editorConfig.language,
            explanation: subtexts,
            isAutomated,
          })
        }}
      >
        Add
      </Button>
    </div>
  )
}

export default CodeEditor
