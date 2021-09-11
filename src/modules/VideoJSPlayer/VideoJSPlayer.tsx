import React, { useRef, useState } from 'react'
import { VideoJS } from './components/VideoJS'
import PropTypes from 'prop-types'
import { VideoJsPlayer } from 'video.js'
import 'videojs-contrib-quality-levels'
// import videoJsResolutionSwitcher from 'videojs-resolution-switcher'

const VideoJSPlayer = () => {
  const playerRef = useRef<any>()
  const [videoURL, setVideoURL] = useState<string>(
    'https://cdn.incredible.dev/teststream/testhlsstream.m3u8'
  )

  const videoJsOptions = {
    autoplay: false,
    playbackRates: [0.5, 1, 1.25, 1.5, 2],
    // aspectratio:'16:9'
    controls: true,
    width: 1280,
    height: 720,
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
    //     'fullscreenToggle',
    //   ],
    // },
    sources: [
      {
        src: videoURL,
        type: 'application/x-mpegURL',
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
