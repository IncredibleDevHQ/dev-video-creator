import React, { createRef } from 'react'
import {
  useRecoilBridgeAcrossReactRoots_UNSTABLE,
  useRecoilValue,
} from 'recoil'
import Konva from 'konva'
import { Stage, Layer, Rect } from 'react-konva'
import { KonvaEventObject } from 'konva/lib/Node'
import MissionControl from './MissionControl'
import StudioUser from './StudioUser'
import { StudioProviderProps, studioStore } from '../stores'

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
  const { state, stream, getBlobs, users } =
    (useRecoilValue(studioStore) as StudioProviderProps) || {}
  const stageRef = createRef<Konva.Stage>()

  const Bridge = useRecoilBridgeAcrossReactRoots_UNSTABLE()

  const handleZoom = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    if (!stageRef.current) return
    const oldScale = stageRef.current.scaleX()
    const pointer = stageRef.current.getPointerPosition()

    if (!pointer || !oldScale) return

    const mousePointTo = {
      x: (pointer.x - stageRef.current.x()) / oldScale,
      y: (pointer.y - stageRef.current.y()) / oldScale,
    }

    const scaleBy = 1.01
    let newScale = 1
    if (e.evt.deltaY > 0) {
      newScale = oldScale / scaleBy > 1 ? oldScale / scaleBy : 1
    } else {
      newScale = oldScale * scaleBy > 4 ? 4 : oldScale * scaleBy
    }

    stageRef.current.scale({ x: newScale, y: newScale })

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    }

    stageRef.current.position(newPos)
  }

  const resetCanvas = () => {
    if (!stageRef.current) return
    stageRef.current.position({ x: 0, y: 0 })
    stageRef.current.scale({ x: 1, y: 1 })
  }

  return (
    <div className="flex-1 mt-4 justify-between items-stretch flex">
      <div className="bg-gray-100 flex-1 rounded-md p-4 flex justify-center items-center mr-8">
        {state === 'ready' || state === 'recording' ? (
          <Stage
            ref={stageRef}
            onWheel={handleZoom}
            height={CONFIG.height}
            width={CONFIG.width}
          >
            <Bridge>
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
                  <>
                    <StudioUser stream={stream as MediaStream} />
                    {users.map((user) => (
                      <StudioUser stream={user.mediaStream as MediaStream} />
                    ))}
                  </>
                )}
              </Layer>
            </Bridge>
          </Stage>
        ) : (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            className="w-8/12 rounded-md"
            controls
            ref={(ref) => {
              if (!ref || !getBlobs) return
              const blob = getBlobs()
              const url = window.URL.createObjectURL(blob)
              // eslint-disable-next-line no-param-reassign
              ref.src = url
            }}
          />
        )}
      </div>
      <MissionControl controls={controls} resetCanvas={resetCanvas} />
    </div>
  )
}

Concourse.defaultProps = {
  disableUserMedia: undefined,
}

export default Concourse
