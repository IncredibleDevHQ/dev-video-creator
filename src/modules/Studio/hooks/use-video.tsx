import React, { useEffect } from 'react'

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
