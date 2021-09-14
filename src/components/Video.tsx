/* eslint-disable @typescript-eslint/no-unused-expressions */
/* eslint-disable react/default-props-match-prop-types */
import React, { HTMLProps, useEffect, useRef, useState } from 'react'
import videojs, { VideoJsPlayer } from 'video.js'
import 'video.js/dist/video-js.css'
import logo from '../assets/IncredibleWhiteLogo.svg'
import qualityLevels from 'videojs-contrib-quality-levels'
import hlsQualitySelector from 'videojs-hls-quality-selector'
import { IoPlayOutline } from 'react-icons/io5'
import Button from './Button'
import { css } from '@emotion/css'

interface VideoProps extends HTMLProps<HTMLVideoElement> {
  src: string
}

const Video = ({ className, src, ...rest }: VideoProps) => {
  const playerRef = useRef<any>()
  const [videoURL, setVideoURL] = useState<string>('')
  const [videoType, setVideoType] = useState<string>('')

  const VideoJS = (props: { options: any; onReady: any }) => {
    const videoRef = useRef<HTMLVideoElement>(null)
    const playerRef = useRef<any>(null)
    const { options, onReady } = props

    const videoJs = css`
      &:vjs-mouse-display:after,
      &:vjs-play-progress:after {
        padding: 0 0.4em 0.3em;
      }
      &:vjs-ended .vjs-loading-spinner {
        display: none;
      }

      font-size: 14px;
      overflow: hidden;

      &:vjs-spacer,
      &:vjs-time-control {
        display: -webkit-box;
        display: -moz-box;
        display: -ms-flexbox;
        display: -webkit-flex;
        display: flex;
        -webkit-box-flex: 0 1 auto;
        -moz-box-flex: 1 1 auto;
        -webkit-flex: 1 1 auto;
        -ms-flex: 1 1 auto;
        flex: 1 1 auto;
      }

      &:vjs-time-control {
        -webkit-box-flex: 0 1 auto;
        -moz-box-flex: 0 1 auto;
        -webkit-flex: 0 1 auto;
        -ms-flex: 0 1 auto;
        flex: 0 1 auto;
        width: auto;
      }

      &:vjs-time-control,
      &:vjs-current-time-display {
        text-align: right;
      }

      &:vjs-time-control,
      &:vjs-duration-display {
        text-align: left;
      }

      &:vjs-play-progress:before,
      &:vjs-progress-control.vjs-play-progress:before,
      &:vjs-remaining-time,
      &:vjs-volume-level:after,
      &:vjs-volume-level:before,
      &:vjs-live.vjs-time-control.vjs-current-time,
      &:vjs-live.vjs-time-control.vjs-duration,
      &:vjs-live.vjs-time-control.vjs-time-divider,
      &:vjs-no-flex.vjs-time-control.vjs-remaining-time {
        display: none;
      }

      &:vjs-progress-control {
        position: absolute;
        left: 0;
        right: 0;
        width: 100%;
        height: 0.5em;
        top: -0.5em;
      }

      &:vjs-progress-control,
      &:vjs-progress-holder {
        margin: 0;
      }

      &:not-hover.vjs-has-started.vjs-paused.vjs-user-active.vjs-control-bar,
      &:not-hover.vjs-has-started.vjs-paused.vjs-user-inactive.vjs-control-bar,
      &:not-hover.vjs-has-started.vjs-playing.vjs-user-active.vjs-control-bar,
      &:not-hover.vjs-has-started.vjs-playing.vjs-user-inactive.vjs-control-bar,
      &:vjs-has-started.vjs-playing.vjs-user-inactive .vjs-control-bar {
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

      &:not-hover.vjs-has-started.vjs-paused.vjs-user-active.vjs-progress-control,
      &:not-hover.vjs-has-started.vjs-paused.vjs-user-inactive.vjs-progress-control,
      &:not-hover.vjs-has-started.vjs-playing.vjs-user-active.vjs-progress-control,
      &:not-hover.vjs-has-started.vjs-playing.vjs-user-inactive.vjs-progress-control,
      &:vjs-has-started.vjs-playing.vjs-user-inactive .vjs-progress-control {
        height: 0.25em;
        top: -0.25em;
        pointer-events: none;
        -webkit-transition: height 1s, top 1s;
        -moz-transition: height 1s, top 1s;
        -ms-transition: height 1s, top 1s;
        -o-transition: height 1s, top 1s;
        transition: height 1s, top 1s;
      }

      &:not-hover.vjs-has-started.vjs-paused.vjs-user-active.vjs-fullscreen.vjs-progress-control,
      &:not-hover.vjs-has-started.vjs-paused.vjs-user-inactive.vjs-fullscreen.vjs-progress-control,
      &:not-hover.vjs-has-started.vjs-playing.vjs-user-active.vjs-fullscreen.vjs-progress-control,
      &:not-hover.vjs-has-started.vjs-playing.vjs-user-inactive.vjs-fullscreen.vjs-progress-control,
      &:vjs-has-started.vjs-playing.vjs-user-inactive.vjs-fullscreen.vjs-progress-control {
        opacity: 0;
        -webkit-transition: opacity 1s ease 1s;
        -moz-transition: opacity 1s ease 1s;
        -ms-transition: opacity 1s ease 1s;
        -o-transition: opacity 1s ease 1s;
        transition: opacity 1s ease 1s;
      }

      &:vjs-live .vjs-live-control {
        margin-left: 1em;
      }

      &:vjs-big-play-button {
        top: 50%;
        left: 50%;
        margin-left: -1em;
        width: 2em;
        border: none;
        color: #fff;
        -webkit-transition: border-color 0.4s, outline 0.4s,
          background-color 0.4s;
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

      &:vjs-menu-button-popup,
      &:vjs-menu,
      &:vjs-menu-content {
        background-color: Grey;
        width: 12em;
        left: -1.5em;
        padding-bottom: 0.5em;
        border-radius: 5%;
      }

      &:vjs-menu-button-popup.vjs-menu.vjs-menu-item,
      &:vjs-menu-button-popup.vjs-menu.vjs-menu-title {
        background-color: grey;
        margin: 0.3em 0;
        padding: 0.5em;
        border-radius: 0.3em;
      }

      &:vjs-loading-spinner {
        border-color: #15803d;
      }

      &:vjs-control-bar {
        background-color: rgba(0, 0, 0, 0.1) !important;
        color: #fff;
        font-size: 14px;
      }

      &:vjs-play-progress,
      &:vjs-volume-level {
        background-color: #15803d;
      }
    `

    useEffect(() => {
      videojs.registerPlugin('qualityLevels', qualityLevels)
      videojs.registerPlugin('hlsQualitySelector', hlsQualitySelector)

      if (!playerRef.current) {
        const videoElement = videoRef.current
        if (!videoElement) return

        const player = videojs(videoElement, options, () => {
          console.log('player is ready')
          onReady && onReady(player)
        })
      } else {
        // you can update player here [update player through props]
        const player = playerRef.current
        player.autoplay(options.autoplay)
        player.src(options.sources)
      }
    }, [options])

    useEffect(() => {
      return () => {
        if (playerRef.current) {
          playerRef.current.dispose()
          playerRef.current = null
        }
      }
    }, [])

    return (
      <div className="container">
        <div data-vjs-player className={videoJs}>
          <video
            id="flick_video"
            ref={videoRef}
            className={`video-js`}
            poster={logo}
            controls
            autoPlay
            width="100%"
            height="100%"
            preload="auto"
            muted
            data-setup="{}"
          />
        </div>
      </div>
    )
  }

  useEffect(() => {
    if (!videoType) return
    const data = src.split('.').slice(-1).join()
    if (data !== 'm3u8') {
      setVideoType(`video/${data}`)
    }
    setVideoType('application/x-mpegURL')
    setVideoURL(src)
  }, [src])

  const videoJsOptions = {
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
        src,
        type: videoType,
      },
    ],
  }

  const handlePlayerReady = (player: VideoJsPlayer) => {
    playerRef.current = player

    player.on('waiting', () => {
      console.log('player is waiting')
    })

    player.on('dispose', () => {
      console.log('player will dispose')
    })
  }

  return <VideoJS options={videoJsOptions} onReady={handlePlayerReady} />
}

Video.defaultProps = {
  src: undefined,
}

export default Video
