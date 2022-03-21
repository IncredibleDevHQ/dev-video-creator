/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import { css, cx } from '@emotion/css'
import React, { ChangeEvent, useState } from 'react'
import { FiLayout } from 'react-icons/fi'
import { HiOutlineDownload } from 'react-icons/hi'
import { MdOutlineTextFields } from 'react-icons/md'
import { Modal } from 'react-responsive-modal'
import { useRecoilValue } from 'recoil'
import { Button, Heading, Text, TextArea, TextField } from '../../../components'
import { IntroBlockViewProps } from '../../../utils/configTypes'
import { newFlickStore } from '../store/flickNew.store'

export type View = 'layout' | 'content'

const ThumbnailModal = ({
  open,
  handleClose,
}: {
  open: boolean
  handleClose: () => void
}) => {
  const [view, setView] = React.useState<View>('layout')
  const [thumbnailConfig, setThumbnailConfig] = useState<IntroBlockViewProps>({
    heading: '',
    name: '',
    designation: '',
  })

  // const { flick, activeFragmentId } = useRecoilValue(newFlickStore)
  // const fragment = flick?.fragments.find((f) => f.id === activeFragmentId)

  return (
    <Modal
      open={open}
      onClose={() => {
        handleClose()
      }}
      center
      styles={{
        modal: {
          height: '100%',
          maxHeight: '90vh',
          maxWidth: '90%',
          padding: 0,
        },
      }}
      classNames={{
        modal: cx(
          'rounded-md w-full',
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
      showCloseIcon={false}
    >
      <div className="w-full h-full flex flex-col">
        <div>
          <div className="flex justify-between items-center px-4 py-2">
            <Heading>Thumbnail</Heading>
            <Button
              appearance="none"
              type="button"
              icon={HiOutlineDownload}
              iconSize={20}
            />
          </div>
          <hr className="w-full h-0.5 bg-gray-300" />
        </div>
        <section className="flex flex-1 items-stretch justify-between">
          <div className="w-2/3 bg-gray-100">
            {/* TODO: call canvas here */}
            {/* NOTE: Pass value of thumbnailConfig (refers to interface IntroBlockViewProps in configType.ts) to canvas */}
          </div>
          <div className="w-1/3 bg-white">
            <div className="flex justify-between items-stretch h-full">
              <div className="flex-1 p-2">
                {view === 'content' && (
                  <ContentView
                    thumbnailConfig={thumbnailConfig}
                    setThumbnailConfig={setThumbnailConfig}
                  />
                )}
              </div>
              <div className="bg-gray-50 w-1/4 flex flex-col justify-start items-center px-2">
                <div
                  className={cx(
                    'w-full py-4 my-2 flex flex-col justify-center items-center rounded-md cursor-pointer',
                    {
                      'bg-gray-200 text-gray-800': view === 'layout',
                      'text-gray-500': view !== 'layout',
                    }
                  )}
                  onClick={() => setView('layout')}
                >
                  <FiLayout size={32} />
                  <Text className="mt-1">Layout</Text>
                </div>
                <div
                  className={cx(
                    'w-full py-4 my-2 flex flex-col justify-center items-center rounded-md cursor-pointer',
                    {
                      'bg-gray-200 text-gray-800': view === 'content',
                      'text-gray-500': view !== 'content',
                    }
                  )}
                  onClick={() => setView('content')}
                >
                  <MdOutlineTextFields size={32} />
                  <Text className="mt-1">Content</Text>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </Modal>
  )
}

const ContentView = ({
  thumbnailConfig,
  setThumbnailConfig,
}: {
  thumbnailConfig: IntroBlockViewProps
  setThumbnailConfig: (thumbnailConfig: IntroBlockViewProps) => void
}) => {
  return (
    <div className="flex flex-col justify-start items-center">
      <TextField
        className="my-1"
        label="Heading"
        value={thumbnailConfig.heading}
        onChange={(e: ChangeEvent<HTMLInputElement>) =>
          setThumbnailConfig({
            ...thumbnailConfig,
            heading: e.target.value,
          })
        }
      />
      <TextField
        className="my-1"
        label="Name"
        value={thumbnailConfig.name}
        onChange={(e: ChangeEvent<HTMLInputElement>) =>
          setThumbnailConfig({
            ...thumbnailConfig,
            name: e.target.value,
          })
        }
      />
      <TextArea
        className="my-1"
        label="Designation"
        value={thumbnailConfig.designation}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
          setThumbnailConfig({
            ...thumbnailConfig,
            designation: e.target.value,
          })
        }
      />
    </div>
  )
}

export default ThumbnailModal
