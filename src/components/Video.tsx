/* eslint-disable @typescript-eslint/no-unused-expressions */
/* eslint-disable react/default-props-match-prop-types */
import React, { HTMLProps, useEffect, useRef, useState } from 'react'
import videojs, { VideoJsPlayer } from 'video.js'
import 'video.js/dist/video-js.css'
import logo from '../assets/IncredibleWhiteLogo.svg'
import '../assets/video.css'
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
      display: block;
      margin: 20px auto;

      &:my-image {
        width: 40px;
        background: url('../../../assets/IncredibleWhiteLogo.svg') center center
          no-repeat;
      }

      &:vjs-menu-button-inline.vjs-slider-active,
      &:vjs-menu-button-inline:focus,
      &:vjs-menu-button-inline:hover,
      &:vjs-no-flex .vjs-menu-button-inline {
        width: 10em;
      }

      &:vjs-controls-disabled .vjs-big-play-button {
        display: none !important;
      }

      &:vjs-control {
        width: 3em;
      }

      &:vjs-menu-button-inline:before {
        width: 1.5em;
      }

      &:vjs-load-progress div,
      .vjs-seeking .vjs-big-play-button,
      .vjs-waiting .vjs-big-play-button {
        display: none !important;
      }

      &:vjs-mouse-display:after,
      &:vjs-play-progress:after {
        padding: 0 0.4em 0.3em;
      }

      &:vjs-ended .vjs-loading-spinner {
        display: none;
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
        <div data-vjs-player>
          <video
            id="flick_video"
            ref={videoRef}
            className="video-js"
            poster={logo}
            controls
            autoPlay
            width="100%"
            height="100%"
            preload="auto"
            muted
            data-setup="{}"
          />
          <div className="vjs-control-bar">
            <div className="vjs-progress-bar vjs-control" />
            <Button
              type="button"
              className="bg-white-500"
              appearance="primary"
              size="small"
              iconPosition="right"
              icon={IoPlayOutline}
            />
            <div className="vjs-control vjs-button">
              <div className="vjs-menu-settings vjs-lock-showing">
                <div className="vjs-menu-div vjs-settings-dev">
                  <div className="vjs-submenu vjs-settings-home">
                    <ul className="vjs-menu-conetent vjs-settings-list">
                      {/* <li className="vjs-settings-item vjs-share-button">
                        "Share"<span className="vjs-share-icon">::before</span>
                        ::after
                      </li> */}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
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
    controlBar: {
      children: [
        'playToggle',
        'volumeMenuButton',
        'playbackRates',
        'currentTimeDisplay',
        'timeDivider',
        'durationDisplay',
        'progressControl',
        'remainingTimeDisplay',
        'shareButton',
        'fullscreenToggle',
      ],
    },
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
