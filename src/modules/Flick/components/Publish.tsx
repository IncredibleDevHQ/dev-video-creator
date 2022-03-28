import { css, cx } from '@emotion/css'
import axios from 'axios'
import React, { useEffect, useState } from 'react'
import { FiExternalLink, FiRefreshCw } from 'react-icons/fi'
import { HiOutlineDownload } from 'react-icons/hi'
import { IoPlayOutline } from 'react-icons/io5'
import Modal from 'react-responsive-modal'
import { Button, emitToast, Heading, Text } from '../../../components'
import config from '../../../config'
import {
  Content_Type_Enum_Enum,
  FlickFragmentFragment,
  RecordingFragment,
  Recording_Status_Enum_Enum,
  useCompleteRecordingMutation,
  useGetRecordingsQuery,
} from '../../../generated/graphql'
import { SimpleAST } from '../editor/utils/utils'

const Publish = ({
  open,
  simpleAST,
  activeFragment,
  handleClose,
}: {
  open: boolean
  simpleAST?: SimpleAST
  activeFragment: FlickFragmentFragment | undefined
  handleClose: (refresh?: boolean) => void
}) => {
  const [recordings, setRecordings] = useState<RecordingFragment[]>([])

  const {
    data: recordingsData,
    error: getRecordingsError,
    refetch,
    startPolling,
    stopPolling,
  } = useGetRecordingsQuery({
    variables: {
      flickId: activeFragment?.flickId,
      fragmentId: activeFragment?.id,
    },
  })

  const [
    completeRecording,
    { error: errorCompletingRecording, loading: loadingCompleteRecording },
  ] = useCompleteRecordingMutation()

  const completeFragmentRecording = async (recordingId: string) => {
    const { data } = await completeRecording({
      variables: {
        editorState: JSON.stringify(simpleAST),
        recordingId,
      },
    })
    if (data?.CompleteRecording?.success) await refetch()
  }

  useEffect(() => {
    if (!recordingsData?.Recording) return
    setRecordings(recordingsData.Recording)
  }, [recordingsData])

  useEffect(() => {
    if (errorCompletingRecording) {
      emitToast({
        title: 'Error producing recording',
        description: errorCompletingRecording.message,
        type: 'error',
      })
    } else if (getRecordingsError) {
      emitToast({
        title: 'Error fetching recordings',
        description: getRecordingsError.message,
        type: 'error',
      })
    }
  }, [errorCompletingRecording, getRecordingsError])

  return (
    <Modal
      open={open}
      onClose={handleClose}
      center
      classNames={{
        modal: cx(
          'rounded-lg w-1/2 max-w-md mx-auto p-4',
          css`
            background-color: #fffffff !important;
          `
        ),
      }}
      showCloseIcon={false}
    >
      <div>
        <div className="flex items-center justify-between">
          <Heading fontSize="medium">Publish</Heading>
          <Button
            appearance="none"
            icon={FiExternalLink}
            iconSize={20}
            iconPosition="left"
            type="button"
          >
            Public Page
          </Button>
        </div>
        <hr />
        <div className="">
          {recordings.map((recording) => (
            <RecordingItem
              key={recording.id}
              recording={recording}
              startPolling={startPolling}
              stopPolling={stopPolling}
              activeFragment={activeFragment}
              loadingCompleteRecording={loadingCompleteRecording}
              completeFragmentRecording={completeFragmentRecording}
            />
          ))}
        </div>
        {/* <hr /> 
  			 <div className="flex justify-between items-center pt-2">
          <Button
            appearance="none"
            icon={HiOutlineDownload}
            iconSize={20}
            iconPosition="left"
            type="button"
          >
            Download
          </Button>
          <Button
            appearance="primary"
            icon={FiExternalLink}
            iconSize={20}
            iconPosition="left"
            type="button"
          >
            Publish
          </Button>
        </div> */}
      </div>
    </Modal>
  )
}

const RecordingItem = ({
  recording,
  stopPolling,
  startPolling,
  activeFragment,
  loadingCompleteRecording,
  completeFragmentRecording,
}: {
  stopPolling: () => void
  recording: RecordingFragment
  loadingCompleteRecording?: boolean
  startPolling: (pollInterval: number) => void
  activeFragment: FlickFragmentFragment | undefined
  completeFragmentRecording: (recordingId: string) => Promise<void>
}) => {
  const { baseUrl } = config.storage

  useEffect(() => {
    if (recording.status === Recording_Status_Enum_Enum.Processing) {
      startPolling(5000)
    } else {
      stopPolling()
    }
  }, [recording.status])

  const downloadVideo = async () => {
    axios({
      url: baseUrl + recording.url,
      method: 'GET',
      responseType: 'blob',
    }).then((response) => {
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `${recording.id}.mp4`)
      document.body.appendChild(link)
      link.click()
    })
  }

  return (
    <div className="flex justify-between items-center py-4">
      <div className="flex justify-between items-center p-2 bg-gray-50 hover:bg-gray-100 w-full rounded-md">
        <div className="flex justify-start items-stretch">
          <div
            className={cx(
              'flex justify-center items-center px-3 rounded-sm mr-2',
              {
                'bg-brand-10 text-brand':
                  recording.type === Content_Type_Enum_Enum.Video,
                'bg-incredible-blue-light-600 text-incredible-blue-600':
                  recording.type === Content_Type_Enum_Enum.VerticalVideo,
              }
            )}
          >
            <IoPlayOutline size={24} />
          </div>
          <div className="ml-2">
            <Heading>{activeFragment?.name || 'Untitled'}</Heading>
            <Text className="text-sm text-gray-500">Last edited </Text>
          </div>
        </div>
        <div className="flex justify-end items-center">
          {(() => {
            if (loadingCompleteRecording) return <></>
            switch (recording.status) {
              case Recording_Status_Enum_Enum.Pending:
                return (
                  <Button
                    size="small"
                    appearance="none"
                    type="button"
                    onClick={() => completeFragmentRecording(recording.id)}
                    loading={loadingCompleteRecording}
                  >
                    Produce Video
                  </Button>
                )
              case Recording_Status_Enum_Enum.Processing:
                return (
                  <Text className="flex items-center">
                    <FiRefreshCw className="mr-2 animate-spin" /> Processing
                  </Text>
                )
              case Recording_Status_Enum_Enum.Completed:
                return (
                  <Button
                    size="small"
                    appearance="none"
                    type="button"
                    onClick={() => completeFragmentRecording(recording.id)}
                  >
                    Produce Again
                  </Button>
                )
              default:
                return <></>
            }
          })()}
          {recording.url &&
            recording.status !== Recording_Status_Enum_Enum.Processing &&
            !loadingCompleteRecording && (
              <Button
                size="small"
                appearance="none"
                icon={HiOutlineDownload}
                iconSize={20}
                iconPosition="left"
                type="button"
                onClick={downloadVideo}
              >
                Download
              </Button>
            )}
        </div>
      </div>
    </div>
  )
}

export default Publish
