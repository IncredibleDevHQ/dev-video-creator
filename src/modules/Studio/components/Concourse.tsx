import React, { useContext } from 'react'
import { Stage, Layer, Rect } from 'react-konva'
import MissionControl from './MissionControl'
import StudioUser from './StudioUser'
import { StudioContext } from '../Studio'

interface ConcourseProps {
  controls: JSX.Element[]
  layerChildren: any[]
  disableUserMedia?: boolean
}

export const CONFIG = {
  width: 912,
  height: 513,
}

const Concourse = ({
  controls,
  layerChildren,
  disableUserMedia,
}: ConcourseProps) => {
  const { state, stream, getBlob } = useContext(StudioContext)
  return (
    <div className="flex-1 mt-4 justify-between items-stretch flex">
      <div className="bg-gray-100 flex-1 rounded-md p-4 flex justify-center items-center mr-8">
        {state === 'ready' || state === 'recording' ? (
          <StudioContext.Consumer>
            {(value) => (
              <Stage height={CONFIG.height} width={CONFIG.width}>
                <StudioContext.Provider value={value}>
                  <Layer>
                    <Rect
                      x={0}
                      y={0}
                      width={CONFIG.width}
                      height={CONFIG.height}
                      fill="black"
                      cornerRadius={8}
                    />
                    {layerChildren}

                    {!disableUserMedia && (
                      <StudioUser stream={stream as MediaStream} />
                    )}
                  </Layer>
                </StudioContext.Provider>
              </Stage>
            )}
          </StudioContext.Consumer>
        ) : (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            className="w-8/12 rounded-md"
            controls
            ref={(ref) => {
              if (!ref) return
              const blob = getBlob()
              const url = window.URL.createObjectURL(blob)
              // eslint-disable-next-line no-param-reassign
              ref.src = url
            }}
          />
        )}
      </div>
      <MissionControl controls={controls} />
    </div>
  )
}

Concourse.defaultProps = {
  disableUserMedia: undefined,
}

export default Concourse
