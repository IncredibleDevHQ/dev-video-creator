import Konva from 'konva'
import React, { createRef, useState } from 'react'
import { Stage, Rect, Layer } from 'react-konva'
import { useRecoilBridgeAcrossReactRoots_UNSTABLE } from 'recoil'
import { HiOutlineUser } from 'react-icons/hi'
import { FiLayout, FiRefreshCcw } from 'react-icons/fi'
import { cx, css } from '@emotion/css'

export const CONFIG = {
  width: 960,
  height: 540,
}

const style = css`
  ::-webkit-scrollbar {
    display: none;
  }
`

function FragmentView() {
  return (
    <div className="p-6 flex w-full">
      <div className="w-min">
        <Preview />
        <Layouts />
      </div>
      <Configurations />
    </div>
  )
}

const Preview = () => {
  const stageRef = createRef<Konva.Stage>()
  const layerRef = createRef<Konva.Layer>()
  const Bridge = useRecoilBridgeAcrossReactRoots_UNSTABLE()

  Konva.pixelRatio = 2

  return (
    <div>
      <Stage ref={stageRef} height={CONFIG.height} width={CONFIG.width}>
        <Bridge>
          <Layer ref={layerRef}>
            <Rect
              x={0}
              y={0}
              width={CONFIG.width}
              height={CONFIG.height}
              fill="#202026"
            />
          </Layer>
        </Bridge>
      </Stage>
    </div>
  )
}

const Layouts = () => {
  return (
    <div className="grid grid-cols-1">
      <div className="flex flex-row items-center bg-gray-50 h-20 mt-8 border-t border-b border-gray-100">
        {/* Title Splash */}
        <div className="h-full px-4 py-2 bg-gray-50">
          <div className="bg-white h-full w-24 border-2 border-gray-200 text-gray-500 rounded-lg flex items-center justify-center">
            Title
          </div>
        </div>
        {/* User Media */}
        <div className="h-full px-4 py-2 bg-gray-100">
          <div className="bg-white h-full w-24 p-1.5 border-2 border-gray-200 text-gray-500 rounded-lg flex items-center justify-center">
            <div className="flex items-center justify-center bg-gray-500 w-full h-full rounded-md">
              <HiOutlineUser className="text-gray-300" size={24} />
            </div>
          </div>
        </div>
        {/* Divider */}
        <div className="h-full flex flex-col items-center justify-center px-2 bg-gray-100">
          <div className="h-full w-px bg-gray-200" />
          <div className="absolute bg-white p-1.5 rounded-md shadow-md">
            <FiRefreshCcw size={16} className="text-gray-600" />
          </div>
        </div>
        {/* Layouts */}
        <div className={cx('flex h-full overflow-x-scroll', style)} />
      </div>
    </div>
  )
}

const Configurations = () => {
  enum Configuration {
    Layouts = 'layouts',
    Background = 'background',
  }

  const [currentConfiguration, setCurrentConfiguration] =
    useState<Configuration>(Configuration.Layouts)

  return (
    <div className="flex-1 flex ml-6">
      {/* Configs */}
      <div className="flex flex-col gap-y-4">
        <div
          role="button"
          tabIndex={-1}
          onKeyUp={() => {}}
          onClick={() => setCurrentConfiguration(Configuration.Layouts)}
          className={cx(
            'border border-gray-300 bg-gray-100 p-2 rounded-lg h-11 w-11 flex items-center justify-center',
            {
              'border-brand': currentConfiguration === Configuration.Layouts,
            }
          )}
        >
          <FiLayout className="text-gray-600" size={24} />
        </div>
        <div
          role="button"
          tabIndex={-1}
          onKeyUp={() => {}}
          onClick={() => setCurrentConfiguration(Configuration.Background)}
          className={cx(
            'border border-gray-300 bg-gray-100 p-2.5 rounded-lg h-11 w-11 flex items-center justify-center',
            {
              'border-brand': currentConfiguration === Configuration.Background,
            }
          )}
        >
          <div className="bg-blue-400 h-full w-full rounded-md" />
        </div>
      </div>
      {/* Selected Config */}
      {currentConfiguration === Configuration.Layouts && (
        <LayoutsConfguration />
      )}
      {currentConfiguration === Configuration.Background && (
        <BackgroundConfiguration />
      )}
    </div>
  )
}

const LayoutsConfguration = () => {
  return (
    <div className="bg-white border ml-6 rounded-lg shadow-md h-72 border-gray-300 w-full flex-row">
      {[1, 2, 3, 4, 5, 6].map(() => (
        <Layout1 />
      ))}
    </div>
  )
}

const BackgroundConfiguration = () => {
  return <div>Background</div>
}

const Layout1 = () => {
  return (
    <div className="border border-gray-300 flex h-20 w-24">
      <div />
      <div />
    </div>
  )
}

export default FragmentView
