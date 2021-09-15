import React, { HTMLProps, useEffect, useRef, useState } from 'react'
import { VideoJS } from './components/VideoJS'
import { VideoJsPlayer } from 'video.js'

interface VideoProps extends HTMLProps<HTMLDivElement> {
  src: string
  type: string
}

const VideoJSPlayer = ({ className, src, type, ...rest }: VideoProps) => {
  const playerRef = useRef<any>()
  const [videoURL, setVideoURL] = useState<string>('')
  const [videoType, setVideoType] = useState<string>('')

  useEffect(() => {
    if (!videoType) return
    const data = src.split('.').slice(-1).join()
    setVideoType(`video/${data}`)
    setVideoURL(src)
  }, [src])

  console.log(src)

  const videoJsOptions = {
    autoplay: false,
    playbackRates: [0.5, 1, 1.25, 1.5, 2],
    aspectratio: '16:9',
    controls: true,
    height: 720,
    width: 1080,
    fluid: true,
    plugins: {
      qualityLevels: {},
      hlsQualitySelector: {},
    },

    // controlBar: {
    //   children: [
    //     'playToggle',
    //     'volumeMenuButton',
    //     'playbackRates',
    //     'currentTimeDisplay',
    //     'timeDivider',
    //     'durationDisplay',
    //     'progressControl',
    //     'remainingTimeDisplay',
    //     'shareButton',
    //     'fullscreenToggle',
    //   ],
    // },
    sources: [
      {
        src: src,
        type: type || 'application/x-mpegURL',
      },
    ],
  }

  const handlePlayerReady = (player: VideoJsPlayer) => {
    playerRef.current = player

    // you can handle player events here
    player.on('waiting', () => {
      console.log('player is waiting')
    })

    player.on('dispose', () => {
      console.log('player will dispose')
    })
  }

  // const changePlayerOptions = () => {
  //   // you can update the player through the Video.js player instance
  //   if (!playerRef.current) {
  //     return;
  //   }
  //   // [update player through instance's api]
  //   playerRef.current.src([{src: 'http://ex.com/video.mp4', type: 'video/mp4'}]);
  //   playerRef.current.autoplay(false);
  // };

  return (
    <>
      <VideoJS options={videoJsOptions} onReady={handlePlayerReady} />
    </>
  )
}

export { VideoJSPlayer }
