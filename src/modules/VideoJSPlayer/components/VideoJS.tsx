import React, { useEffect, useRef } from 'react'
import videojs, { VideoJsLogo } from 'video.js'
import 'video.js/dist/video-js.css'
import '../utils/Styling.css'
import logo from '../../../assets/IncredibleWhiteLogo.svg'
import qualityLevels from 'videojs-contrib-quality-levels'
import hlsQualitySelector from 'videojs-hls-quality-selector'
import 'videojs-logo'
import 'videojs-logo/dist/videojs-logo.css'

const VideoJS = (props: { options: any; onReady: any }) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const playerRef = useRef<any>(null)
  const { options, onReady } = props

  useEffect(() => {
    videojs.registerPlugin('qualityLevels', qualityLevels)
    videojs.registerPlugin('hlsQualitySelector', hlsQualitySelector)

    if (!playerRef.current) {
      const videoElement = videoRef.current
      if (!videoElement) return

      const player = videojs(videoElement, options, () => {
        console.log('player is ready')
        onReady && onReady(player)
        player.logo({
          image: '../../../assets/hero.png',
          url: 'https://incredible.dev/',
        })
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
    <div data-vjs-player>
      <div className="container">
        <div className="c-video">
          <video
            id="flick_video"
            ref={videoRef}
            className="video-js vjs-theme-forest"
            poster={logo}
            controls
            autoPlay
            width="100%"
            height="100%"
            preload="auto"
            muted
            data-setup="{}"
          />

          {/* <div className="vjs-control-bar">
            <div className="vjs-control vjs-button">
              <div className="vjs-menu-settings vjs-lock-showing">
                <div className="vjs-menu-div vjs-settings-dev">
                  <div className="vjs-submenu vjs-settings-home">
                    <ul className="vjs-menu-conetent vjs-settings-list">
                      <li className="vjs-settings-item vjs-share-button">
                        "Share"<span className="vjs-share-icon">::before</span>
                        ::after
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div> */}
        </div>
      </div>
    </div>
  )
}

export { VideoJS }
