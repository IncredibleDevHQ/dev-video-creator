import { cx } from '@emotion/css'
import React, { useEffect, useState } from 'react'
import { BiPlayCircle } from 'react-icons/bi'
import { IoDesktopOutline, IoPhonePortraitOutline } from 'react-icons/io5'
import { useHistory } from 'react-router-dom'
import { useRecoilState } from 'recoil'
import { FragmentVideoModal } from '.'
import { Button, emitToast, Heading } from '../../../components'
import { TextEditorParser } from '../../../components/TempTextEditor/utils'
import {
  Content_Type_Enum_Enum,
  FlickFragmentFragment,
  Fragment_Type_Enum_Enum,
  useUpdateFlickMarkdownMutation,
  useUpdateFragmentMarkdownMutation,
  useUpdateFragmentStateMutation,
} from '../../../generated/graphql'
import { ViewConfig } from '../../../utils/configTypes'
import { newFlickStore, View } from '../store/flickNew.store'
import { IntroOutroConfiguration } from './IntroOutroView'

// const dashArray = 10 * Math.PI * 2

const FragmentBar = ({
  config,
  markdown,
  editorValue,
  setViewConfig,
  plateValue,
  introConfig,
}: {
  editorValue?: string
  markdown?: string
  config: ViewConfig
  plateValue?: any
  setViewConfig: React.Dispatch<React.SetStateAction<ViewConfig>>
  introConfig: IntroOutroConfiguration
}) => {
  const [fragmentVideoModal, setFragmentVideoModal] = useState(false)
  const [{ flick, activeFragmentId, view }, setFlickStore] =
    useRecoilState(newFlickStore)
  const history = useHistory()

  const [fragment, setFragment] = useState<FlickFragmentFragment | undefined>(
    flick?.fragments.find((f) => f.id === activeFragmentId)
  )

  const [updateFragmentMarkdown] = useUpdateFragmentMarkdownMutation()
  const [updateFlickMarkdown] = useUpdateFlickMarkdownMutation()

  const [updateFragmentState, { data, error }] =
    useUpdateFragmentStateMutation()

  const [savingConfig, setSavingConfig] = useState(false)

  useEffect(() => {
    const f = flick?.fragments.find((f) => f.id === activeFragmentId)
    setFragment(f)
  }, [activeFragmentId, flick])

  useEffect(() => {
    if (!data) return
    emitToast({
      type: 'success',
      title: 'Configuration saved',
    })
  }, [data])

  useEffect(() => {
    if (!error) return
    emitToast({
      type: 'error',
      title: 'Error saving configuration',
    })
  }, [error])

  const updateConfig = async () => {
    setSavingConfig(true)
    try {
      if (
        fragment &&
        (fragment?.type === Fragment_Type_Enum_Enum.Intro ||
          fragment?.type === Fragment_Type_Enum_Enum.Outro)
      ) {
        await updateFragmentState({
          variables: {
            editorState: {},
            id: activeFragmentId,
            configuration: introConfig,
          },
        })
        if (flick)
          setFlickStore((store) => ({
            ...store,
            flick: {
              ...flick,
              fragments: flick.fragments.map((f) =>
                f.id === activeFragmentId
                  ? {
                      ...f,
                      configuration: config,
                    }
                  : f
              ),
            },
          }))
      } else {
        if (!editorValue || editorValue?.length === 0) return
        await updateFragmentMarkdown({
          variables: {
            fragmentId: activeFragmentId,
            md: markdown,
          },
        })
        await updateFlickMarkdown({
          variables: {
            id: flick?.id,
            md: editorValue,
          },
        })
        await updateFragmentState({
          variables: {
            editorState: plateValue,
            id: activeFragmentId,
            configuration: config,
          },
        })
        if (flick)
          setFlickStore((store) => ({
            ...store,
            flick: {
              ...flick,
              fragments: flick.fragments.map((f) =>
                f.id === activeFragmentId
                  ? {
                      ...f,
                      configuration: config,
                      editorState: editorValue,
                    }
                  : f
              ),
            },
          }))
      }
    } catch (error) {
      emitToast({
        type: 'error',
        title: 'Error updating fragment',
      })
    } finally {
      setSavingConfig(false)
    }
  }

  const [mode, setMode] = useState<Content_Type_Enum_Enum>(
    Content_Type_Enum_Enum.Video
  )

  useEffect(() => {
    if (config.mode === 'Portrait') {
      setMode(Content_Type_Enum_Enum.VerticalVideo)
    } else {
      setMode(Content_Type_Enum_Enum.Video)
    }
  }, [config.mode])

  return (
    <div className="sticky flex items-center justify-between px-4 bg-dark-300 w-full">
      <div className="flex items-center justify-start text-dark-title py-2">
        <Heading
          className={cx('cursor-pointer hover:text-white', {
            'text-white': view === View.Notebook,
          })}
          onClick={() =>
            setFlickStore((prev) => ({ ...prev, view: View.Notebook }))
          }
        >
          Notebook
        </Heading>
        <Heading
          className={cx('cursor-pointer hover:text-white ml-4', {
            'text-white': view === View.Preview,
          })}
          onClick={() =>
            setFlickStore((prev) => ({ ...prev, view: View.Preview }))
          }
        >
          Preview
        </Heading>
      </div>
      <div className="flex justify-end items-stretch border-l-2 py-2 pl-4 border-brand-grey">
        <Button
          appearance="gray"
          size="small"
          type="button"
          className="mr-4"
          icon={IoDesktopOutline}
          onClick={() => setViewConfig({ ...config, mode: 'Landscape' })}
        />
        <Button
          appearance="none"
          size="small"
          type="button"
          className="mr-4"
          icon={IoPhonePortraitOutline}
          onClick={() => setViewConfig({ ...config, mode: 'Portrait' })}
        />
        {(fragment?.producedLink || fragment?.producedShortsLink) &&
          (mode === Content_Type_Enum_Enum.Video ||
            mode === Content_Type_Enum_Enum.VerticalVideo) && (
            <Button
              appearance="gray"
              size="small"
              type="button"
              className="mr-4"
              icon={BiPlayCircle}
              iconSize={20}
              onClick={() => {
                setFragmentVideoModal(true)
              }}
            />
          )}
        <Button
          appearance="primary"
          size="small"
          type="button"
          loading={savingConfig}
          disabled={checkDisabledState(fragment, plateValue)}
          onClick={async () => {
            await updateConfig()
            history.push(`/${activeFragmentId}/studio`)
          }}
        >
          {checkHasContent(fragment, mode) ? 'Re-take' : 'Record'}
        </Button>
      </div>
      {fragmentVideoModal && (
        <FragmentVideoModal
          open={fragmentVideoModal}
          handleClose={() => {
            setFragmentVideoModal(false)
          }}
          contentType={mode}
        />
      )}
    </div>
  )
}

const checkDisabledState = (
  fragment: FlickFragmentFragment | undefined,
  editorValue: any
) => {
  if (!fragment) return true
  if (
    fragment.type === Fragment_Type_Enum_Enum.Intro ||
    fragment.type === Fragment_Type_Enum_Enum.Outro
  ) {
    if (fragment.configuration) return false
    return true
  }

  if (
    editorValue &&
    new TextEditorParser(editorValue).isValid() &&
    editorValue.blocks.length > 0
  )
    return false

  return true
}

const checkHasContent = (
  fragment: FlickFragmentFragment | undefined,
  mode: Content_Type_Enum_Enum
) => {
  switch (mode) {
    case Content_Type_Enum_Enum.Video:
      if (fragment?.producedLink) return true
      break

    case Content_Type_Enum_Enum.VerticalVideo:
      if (fragment?.producedShortsLink) return true
      break

    default:
      return false
  }
  return false
}

export default FragmentBar
