import React, { useEffect, useRef } from 'react'
import videojs from 'video.js'
import 'video.js/dist/video-js.css'
import '../utils/Styling.css'
import logo from '../../../assets/IncredibleWhiteLogo.svg'
import qualityLevels from 'videojs-contrib-quality-levels'
import hlsQualitySelector from 'videojs-hls-quality-selector'

const VideoJS = (props: { options: any; onReady: any }) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const playerRef = useRef<any>(null)
  const { options, onReady } = props

  useEffect(() => {
    videojs.registerPlugin('qualityLevels', qualityLevels)
    videojs.registerPlugin('hlsQualitySelector', hlsQualitySelector)
    // make sure Video.js player is only initialized once
    if (!playerRef.current) {
      const videoElement = videoRef.current
      if (!videoElement) return

      const player = videojs(videoElement, options, () => {
        console.log('player is ready')
        onReady && onReady(player)
      })
    } else {
      // you can update player here [update player through props]
      // const player = playerRef.current;
      // player.autoplay(options.autoplay);
      // player.src(options.sources);
    }
  }, [options])

  // Dispose the Video.js player when the functional component unmounts
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
            width="1280px"
            height="720px"
            poster={logo}
            controls
            loop
            preload="auto"
            muted
            data-setup="{}"
          />
          {/*<div className="controller">
            <div className="progress-bar">
              <div className="green-bar"></div>
              <div>
                <div className="button">
                  <button id="play-pause">Button2</button>
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
