/* eslint-disable @typescript-eslint/no-unused-expressions */
/* eslint-disable react/default-props-match-prop-types */
import React, { HTMLProps, useEffect, useRef, useState } from 'react'
import videojs, { VideoJsPlayer } from 'video.js'
import 'video.js/dist/video-js.css'
import 'videojs-logo'
import 'videojs-logo/dist/videojs-logo.css'
import qualityLevels from 'videojs-contrib-quality-levels'
import hlsQualitySelector from 'videojs-hls-quality-selector'
import { css, cx } from '@emotion/css'
import { ASSETS } from '../constants'
import config from '../config'

const videoJs = css`
  .video-js {
    font-size: 14px;
    overflow: hidden;
  }

  .video-js .vjs-playback-rate {
    text-align: left;
  }

  .video-js .vjs-spacer,
  .video-js .vjs-time-control {
    display: -webkit-box;
    display: -moz-box;
    display: -ms-flexbox;
    display: -webkit-flex;
    display: flex;
    -webkit-box-flex: 1 1 auto;
    -moz-box-flex: 1 1 auto;
    -webkit-flex: 1 1 auto;
    -ms-flex: 1 1 auto;
    flex: 1 1 auto;
  }

  .video-js .vjs-time-control {
    -webkit-box-flex: 0 1 auto;
    -moz-box-flex: 0 1 auto;
    -webkit-flex: 0 1 auto;
    -ms-flex: 0 1 auto;
    flex: 0 1 auto;
    width: auto;
  }

  .video-js .vjs-menu-button-popup .vjs-menu-content {
    background-color: #2d2f34;
    width: 12em;
    left: 0em;
    bottom: ;
    padding-bottom: 0.5em;
    border-radius: 5%;
  }

  .video-js .vjs-volume-control {
    height: 50px;
  }

  .video-js .vjs-play-progress:before,
  .video-js .vjs-progress-control .vjs-play-progress:before,
  .video-js .vjs-remaining-time,
  .video-js.vjs-live .vjs-time-control.vjs-current-time,
  .video-js.vjs-live .vjs-time-control.vjs-duration,
  .video-js.vjs-live .vjs-time-control.vjs-time-divider,
  .video-js.vjs-no-flex .vjs-time-control.vjs-remaining-time {
    display: none;
  }

  .video-js .vjs-progress-control {
    position: absolute;
    left: 0;
    right: 0;
    width: 100%;
    height: 0.5em;
    top: -0.5em;
  }

  .video-js .vjs-progress-control .vjs-progress-holder {
    margin: 0;
  }

  .video-js.not-hover.vjs-has-started.vjs-paused.vjs-user-active
    .vjs-control-bar,
  .video-js.not-hover.vjs-has-started.vjs-paused.vjs-user-inactive
    .vjs-control-bar,
  .video-js.not-hover.vjs-has-started.vjs-playing.vjs-user-active
    .vjs-control-bar,
  .video-js.not-hover.vjs-has-started.vjs-playing.vjs-user-inactive
    .vjs-control-bar,
  .video-js.vjs-has-started.vjs-playing.vjs-user-inactive .vjs-control-bar {
    visibility: visible;
    opacity: 1;
    -webkit-backface-visibility: hidden;
    backface-visibility: hidden;
    -webkit-transform: translateY(3em);
    -moz-transform: translateY(3em);
    -ms-transform: translateY(3em);
    -o-transform: translateY(3em);
    transform: translateY(3em);
    -webkit-transition: -webkit-transform 1s ease 0s;
    -moz-transition: -moz-transform 1s ease 0s;
    -ms-transition: -ms-transform 1s ease 0s;
    -o-transition: -o-transform 1s ease 0s;
    transition: transform 1s ease 0s;
  }

  .video-js.not-hover.vjs-has-started.vjs-paused.vjs-user-active
    .vjs-progress-control,
  .video-js.not-hover.vjs-has-started.vjs-paused.vjs-user-inactive
    .vjs-progress-control,
  .video-js.not-hover.vjs-has-started.vjs-playing.vjs-user-active
    .vjs-progress-control,
  .video-js.not-hover.vjs-has-started.vjs-playing.vjs-user-inactive
    .vjs-progress-control,
  .video-js.vjs-has-started.vjs-playing.vjs-user-inactive
    .vjs-progress-control {
    height: 0.25em;
    top: -0.25em;
    pointer-events: none;
    -webkit-transition: height 1s, top 1s;
    -moz-transition: height 1s, top 1s;
    -ms-transition: height 1s, top 1s;
    -o-transition: height 1s, top 1s;
    transition: height 1s, top 1s;
  }

  .video-js.not-hover.vjs-has-started.vjs-paused.vjs-user-active.vjs-fullscreen
    .vjs-progress-control,
  .video-js.not-hover.vjs-has-started.vjs-paused.vjs-user-inactive.vjs-fullscreen
    .vjs-progress-control,
  .video-js.not-hover.vjs-has-started.vjs-playing.vjs-user-active.vjs-fullscreen
    .vjs-progress-control,
  .video-js.not-hover.vjs-has-started.vjs-playing.vjs-user-inactive.vjs-fullscreen
    .vjs-progress-control,
  .video-js.vjs-has-started.vjs-playing.vjs-user-inactive.vjs-fullscreen
    .vjs-progress-control {
    opacity: 0;
    -webkit-transition: opacity 1s ease 1s;
    -moz-transition: opacity 1s ease 1s;
    -ms-transition: opacity 1s ease 1s;
    -o-transition: opacity 1s ease 1s;
    transition: opacity 1s ease 1s;
  }

  .video-js.vjs-live .vjs-live-control {
    margin-left: 1em;
  }

  .video-js .vjs-big-play-button {
    top: 50%;
    left: 50%;
    margin-left: -1em;
    width: 2em;
    border: none;
    color: #fff;
    -webkit-transition: border-color 0.4s, outline 0.4s, background-color 0.4s;
    -moz-transition: border-color 0.4s, outline 0.4s, background-color 0.4s;
    -ms-transition: border-color 0.4s, outline 0.4s, background-color 0.4s;
    -o-transition: border-color 0.4s, outline 0.4s, background-color 0.4s;
    transition: border-color 0.4s, outline 0.4s, background-color 0.4s;
    background-color: rgba(0, 0, 0.3, 0.45);
    font-size: 3.5em;
    border-radius: 50%;
    height: 2em !important;
    line-height: 2em !important;
    margin-top: -1em !important;
  }

  .video-js .vjs-loading-spinner {
    border-color: #15803d;
  }

  .video-js .vjs-control-bar {
    background-color: rgba(0, 0, 0, 0.1) !important;
    color: #fff;
    font-size: 14px;
  }

  .video-js .vjs-play-progress {
    background-color: #15803d;
  }

  .video-js .vjs-volume-level {
    background-color: #fff;
    opacity: 80%;
  }

  .video-js .vjs-volume-vertical {
    background-color: #2d2f34;
    opacity: 80%;
    width: 20px;
    padding-bottom: 0.5px;
    border-radius: 5%;
  }
`
interface VideoProps extends HTMLProps<HTMLVideoElement> {
  src: string
}

const getOptions = (src: string, type: string) => ({
  autoplay: false,
  playbackRates: [0.5, 1, 1.25, 1.5],
  aspectratio: '16:9',
  controls: true,
  height: 720,
  width: 1080,
  fluid: true,
  plugins: {
    qualityLevels: {},
    hlsQualitySelector: {},
  },
  sources: [
    {
      src,
      type,
    },
  ],
  controlBar: {
    volumePanel: { inline: false },
    children: [
      'playToggle',
      'volumeMenuButton',
      {
        name: 'volumePanel',
      },
      'playbackRateMenuButton',
      'currentTimeDisplay',
      'timeDivider',
      'durationDisplay',
      'remainingTimeDisplay',
      'progressControl',
      'liveDisplay',
      'spacer',
      'ResolutionButton',
      'fullscreenToggle',
    ],
  },
})

const Video = ({ className, src, ...rest }: VideoProps) => {
  const playerRef = useRef<any>()
  const [videoType, setVideoType] = useState<string>('')
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (!videoType) return
    const data = src.split('.').slice(-1).join()
    if (data !== 'm3u8') {
      setVideoType(`video/${data}`)
    } else setVideoType('application/x-mpegURL')
  }, [src])

  useEffect(() => {
    videojs.registerPlugin('qualityLevels', qualityLevels)
    videojs.registerPlugin('hlsQualitySelector', hlsQualitySelector)
    return () => {
      if (playerRef.current) {
        playerRef.current.dispose()
        playerRef.current = null
      }
    }
  }, [])

  const handlePlayerReady = (player: VideoJsPlayer) => {
    playerRef.current = player
    player.on('waiting', () => {})
    player.on('dispose', () => {})
  }

  useEffect(() => {
    if (!videoRef.current) return
    const options = getOptions(src, videoType)
    const videoElement = videoRef.current
    if (!videoElement) return

    const player = videojs(videoElement, options, () => {
      handlePlayerReady && handlePlayerReady(player)
    })

    player.logo({
      url: config.client.publicUrl,
      image: ASSETS.ICONS.WhiteLOGO,
      fadeDelay: null,
      height: 10,
      padding: 10,
      position: 'top-left',
      offsetH: 0,
      hideOnReady: false,
    })
  }, [playerRef.current])

  return (
    <div className={cx(videoJs, className)}>
      <div data-vjs-player>
        <video
          id="flick_video"
          ref={videoRef}
          className="video-js"
          controls
          width="100%"
          height="100%"
          preload="auto"
          muted
          data-setup="{}"
          {...rest}
        />
      </div>
    </div>
  )
}

Video.defaultProps = {
  src: undefined,
}

export default Video
