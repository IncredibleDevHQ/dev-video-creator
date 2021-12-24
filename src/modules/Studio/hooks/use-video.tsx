import { IAgoraRTCRemoteUser } from 'agora-rtc-sdk-ng'
import React, { useEffect } from 'react'

export interface RTCUser extends IAgoraRTCRemoteUser {
  mediaStream?: MediaStream
}

const useVideo = (stream: MediaStream) => {
  const video = React.useMemo(() => {
    return document.createElement('video')
  }, [stream])

  useEffect(() => {
    if (!stream) {
      return
    }
    video.srcObject = stream
    video.onloadedmetadata = () => {
      video.play()
    }
  }, [stream])
  return video
}

export default useVideo
