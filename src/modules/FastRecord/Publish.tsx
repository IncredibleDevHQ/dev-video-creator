import React, { ChangeEvent, useEffect, useState } from 'react'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import { FiExternalLink } from 'react-icons/fi'
import { IoCopyOutline } from 'react-icons/io5'
import { Button, Confetti, emitToast, Heading, Text } from '../../components'
import config from '../../config'
import {
  Recording_Status_Enum_Enum,
  StudioFragmentFragment,
  useCompleteRecordingMutation,
  useGetRecordingsLazyQuery,
  usePublishVideoActionMutation,
} from '../../generated/graphql'
import { IPublish } from '../Flick/components/Publish'

const Publish = ({
  flickDescription,
  flickName,
  recordingId,
  fragment,
}: {
  recordingId: string
  flickName: string
  flickDescription: string | undefined
  fragment: StudioFragmentFragment
}) => {
  const [title, setTitle] = useState<string>(flickName)
  const [description, setDescription] = useState<string | undefined>(
    flickDescription
  )

  const [publishing, setPublishing] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)

  const [doPublish, { data: doPublishData }] = usePublishVideoActionMutation({
    onCompleted: () => {
      setPublishing(false)
      setShowConfetti(true)
      setTimeout(() => {
        setShowConfetti(false)
      }, 2500)
    },
    onError: (error) => {
      setPublishing(false)
      emitToast({
        title: 'Could not publish your video',
        type: 'error',
        description: error.message,
      })
    },
  })

  const [getRecordings, { data: recordingsData, startPolling, stopPolling }] =
    useGetRecordingsLazyQuery({
      variables: {
        flickId: fragment.flickId,
        fragmentId: fragment.id,
      },
      fetchPolicy: 'network-only',
      onError: (error) => {
        setPublishing(false)
        emitToast({
          title: 'Could not get recordings',
          type: 'error',
          description: error.message,
        })
      },
    })

  const [stitch] = useCompleteRecordingMutation({
    fetchPolicy: 'no-cache',
    onCompleted: async () => {
      await getRecordings()
      startPolling(3000)
    },
    onError: (error) => {
      setPublishing(false)
      emitToast({
        title: 'Could not stitch your video',
        type: 'error',
        description: error.message,
      })
    },
  })

  useEffect(() => {
    if (!recordingsData) return
    if (
      recordingsData.Recording[0].status !==
      Recording_Status_Enum_Enum.Processing
    ) {
      stopPolling()
    }
    if (
      recordingsData.Recording[0].status ===
      Recording_Status_Enum_Enum.Completed
    ) {
      const publish = {
        title,
        description,
        ctas: [],
      } as IPublish
      doPublish({
        variables: {
          data: publish,
          fragmentId: fragment.id,
          recordingId,
        },
      })
    }
  }, [recordingsData])

  if (doPublishData)
    return (
      <>
        <Confetti fire={showConfetti} />
        <div className="flex w-full h-full items-center justify-center">
          <div
            className="flex flex-col w-full h-full items-start justify-center"
            style={{
              maxWidth: '420px',
              width: '100%',
            }}
          >
            <Heading className="mb-4 font-bold text-3xl mt-12">
              Your recording is ready!
            </Heading>
            <Text className="font-body">
              Your recording is available in this link. Share it with the world!
            </Text>
            <div className="flex items-center gap-x-4">
              <a
                href={`${config.auth.endpoint}/watch/${fragment.flick?.joinLink}`}
                target="_blank"
                rel="noreferrer noopener"
                className="w-full flex my-4 border border-gray-600 p-2 rounded-md items-center justify-between text-sm gap-x-8 text-gray-200 px-2"
              >
                {`${config.auth.endpoint}/watch/${fragment.flick?.joinLink}`}
                <FiExternalLink size={21} className="mx-2" />
              </a>
              <CopyToClipboard
                text={`${config.auth.endpoint}/watch/${fragment.flick?.joinLink}`}
                onCopy={() => {
                  emitToast({
                    title: 'Copied url',
                    type: 'success',
                    autoClose: 1500,
                  })
                }}
              >
                <div className="bg-dark-100 hover:bg-dark-200 active:bg-dark-400 rounded-md cursor-pointer">
                  <IoCopyOutline size={18} className="m-2.5" />
                </div>
              </CopyToClipboard>
            </div>
          </div>
        </div>
      </>
    )

  return (
    <div className="w-full h-full flex flex-col text-white p-8">
      <h1 className="text-lg font-main w-full flex justify-center">
        Publish video
      </h1>
      <span className="text-sm mt-8">Title</span>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        className="mt-2 w-full bg-dark-400 py-2 px-2.5 rounded-sm focus:ring-0 focus:outline-none text-sm font-body border border-transparent focus:border-brand"
      />
      <span className="text-sm mt-6">Description (optional)</span>
      <textarea
        placeholder="Description"
        className="mt-2 font-body bg-dark-400 text-sm rounded-sm border border-transparent outline-none flex-1 focus:ring-0 p-2 focus:border-brand resize-none w-full"
        value={description}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
          setDescription(e.target.value)
        }
      />
      <Button
        className="mt-8 bg-incredible-green-500 border-incredible-green-500"
        size="small"
        type="button"
        appearance="primary"
        loading={publishing}
        onClick={() => {
          setPublishing(true)
          stitch({
            variables: {
              recordingId,
              editorState: JSON.stringify(fragment.editorState),
            },
          })
        }}
      >
        Publish
      </Button>
    </div>
  )
}

export default Publish
