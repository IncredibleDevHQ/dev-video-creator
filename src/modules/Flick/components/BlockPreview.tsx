import { css, cx } from '@emotion/css'
import Konva from 'konva'
import React, { createRef, useEffect, useState } from 'react'
import useMeasure, { RectReadOnly } from 'react-use-measure'
import { Stage, Layer, Rect } from 'react-konva'
import Modal from 'react-responsive-modal'
import { useRecoilBridgeAcrossReactRoots_UNSTABLE } from 'recoil'
import { Block } from '../../../components/TextEditor/utils'
import UnifiedFragment from '../../Studio/effects/fragments/UnifiedFragment'
import {
  ViewConfig,
  GradientConfig,
  BlockProperties,
  allLayoutTypes,
  Layout,
  Gradient,
} from '../../../utils/configTypes2'
import { CONFIG, SHORTS_CONFIG } from '../../Studio/components/Concourse'
import { Tab, TabBar } from '../../../components'
import LayoutGeneric from './LayoutGeneric'

const previewTabs: Tab[] = [
  {
    name: 'Layout',
    value: 'layout',
  },
  {
    name: 'Background',
    value: 'background',
  },
]

export const gradients: Gradient[] = [
  {
    angle: 90,
    values: [0, '#D397FA', 0.0001, '#D397FA', 1, '#8364E8'],
    cssString:
      'linear-gradient(90deg, #D397FA 0%, #D397FA 0.01%, #8364E8 100%)',
  },
  {
    angle: 90,
    values: [0.0001, '#FFAFBD', 1, '#FFC3A0'],
    cssString: 'linear-gradient(90deg, #FFAFBD 0.01%, #FFC3A0 100%)',
  },
  {
    angle: 90,
    values: [0.0001, '#8879B2', 1, '#EAAFC8'],
    cssString: 'linear-gradient(90deg, #8879B2 0.01%, #EAAFC8 100%)',
  },
  {
    angle: 90,
    values: [0.0001, '#8BC6EC', 1, '#9599E2'],
    cssString: 'linear-gradient(90deg, #8BC6EC 0.01%, #9599E2 100%)',
  },
  {
    angle: 43.58,
    values: [0.424, '#FBDA61', 0.9792, '#FF5ACD'],
    cssString: 'linear-gradient(43.58deg, #FBDA61 4.24%, #FF5ACD 97.92%)',
  },
  {
    angle: 180,
    values: [0.0001, '#A9C9FF', 1, '#FFBBEC'],
    cssString: 'linear-gradient(180deg, #A9C9FF 0.01%, #FFBBEC 100%)',
  },
  {
    angle: 226.32,
    values: [0.0001, '#FF3CAC', 0.524, '#784BA0', 1, '#2B86C5'],
    cssString:
      'linear-gradient(226.32deg, #FF3CAC -25.84%, #784BA0 40.09%, #2B86C5 100%)',
  },
  {
    angle: 47.5,
    values: [0, '#74EBD5', 0.96, '#9FACE6'],
    cssString: 'linear-gradient(47.5deg, #74EBD5 0%, #9FACE6 96%)',
  },
  {
    angle: 46.2,
    values: [0, '#85FFBD', 0.9802, '#FFFED3'],
    cssString: 'linear-gradient(46.2deg, #85FFBD 0%, #FFFED3 98.02%)',
  },
  {
    angle: 42.22,
    values: [0.278, '#FBAB7E', 0.9837, '#F7CE68'],
    cssString: 'linear-gradient(42.22deg, #FBAB7E 2.78%, #F7CE68 98.37%)',
  },
  {
    angle: 90,
    values: [0.0001, '#43CEA2', 1, '#548AC0'],
    cssString: 'linear-gradient(90deg, #43CEA2 0.01%, #548AC0 100%)',
  },
  {
    angle: 226.32,
    values: [
      0.0001,
      '#FFCC70',
      0.0812,
      '#F6B97C',
      0.5829,
      '#CE74C8',
      1,
      '#2B86C5',
    ],
    cssString:
      'linear-gradient(226.32deg, #FFCC70 -25.84%, #F6B97C -15.62%, #CE74C8 47.51%, #2B86C5 100%)',
  },
]

export const getGradientConfig = (gradient: Gradient) => {
  const [width, height] = [960, 540]
  // Specify angle in degrees
  const angleInDeg = gradient.angle

  // Compute angle in radians - CSS starts from 180 degrees and goes clockwise
  // Math functions start from 0 and go anti-clockwise so we use 180 - angleInDeg to convert between the two
  const angle = ((180 - angleInDeg) / 180) * Math.PI

  // This computes the length such that the start/stop points will be at the corners
  const length =
    Math.abs(width * Math.sin(angle)) + Math.abs(height * Math.cos(angle))

  // Compute the actual x,y points based on the angle, length of the gradient line and the center of the div
  const halfx = (Math.sin(angle) * length) / 2.0
  const halfy = (Math.cos(angle) * length) / 2.0
  const cx = width / 2.0
  const cy = height / 2.0
  const x1 = cx - halfx
  const y1 = cy - halfy
  const x2 = cx + halfx
  const y2 = cy + halfy

  return {
    cssString: gradient.cssString,
    values: gradient.values,
    startIndex: { x: x1, y: y1 },
    endIndex: { x: x2, y: y2 },
  } as GradientConfig
}

const useGetHW = ({
  maxH,
  maxW,
  aspectRatio,
}: {
  maxH: number
  maxW: number
  aspectRatio: number
}) => {
  let calWidth = 0
  let calHeight = 0
  if (aspectRatio > maxW / maxH) {
    calHeight = maxW * (1 / aspectRatio)
    calWidth = maxW
  } else if (aspectRatio <= maxW / maxH) {
    calHeight = maxH
    calWidth = maxH * aspectRatio
  }
  return { width: calWidth, height: calHeight }
}

export const GradientSelector = ({
  currentGradient,
  updateGradient,
}: {
  currentGradient: GradientConfig
  updateGradient: (gradient: GradientConfig) => void
}) => {
  return (
    <div className="grid grid-cols-2 gap-2 w-full bg-white p-4">
      {gradients.map((gradient, index) => (
        // eslint-disable-next-line jsx-a11y/control-has-associated-label
        <div
          // eslint-disable-next-line react/no-array-index-key
          key={index}
          tabIndex={0}
          role="button"
          onKeyDown={() => null}
          onClick={() => updateGradient(getGradientConfig(gradient))}
          className={cx(
            'w-32 h-16 p-2 border border-gray-200 rounded-md cursor-pointer bg-white',
            {
              'border-brand': gradient.cssString === currentGradient.cssString,
            },
            css`
              background: ${gradient.cssString};
            `
          )}
        />
      ))}
    </div>
  )
}

const LayoutSelector = ({
  type,
  layout,
  updateLayout,
}: {
  layout: Layout
  updateLayout: (layout: Layout) => void
  type: Block['type']
}) => {
  return (
    <div className="grid grid-cols-2 gap-2 w-full">
      {allLayoutTypes?.map((layoutType) => (
        <LayoutGeneric
          type={type}
          key={layoutType}
          layout={layoutType}
          isSelected={layout === layoutType}
          onClick={() => updateLayout(layoutType)}
        />
      ))}
    </div>
  )
}

const CanvasPreview = ({
  block,
  bounds,
  config,
  shortsMode,
  blockProperties,
}: {
  block: Block
  bounds: RectReadOnly
  shortsMode: boolean
  config: ViewConfig
  blockProperties: BlockProperties
}) => {
  const stageRef = createRef<Konva.Stage>()
  const layerRef = createRef<Konva.Layer>()
  const Bridge = useRecoilBridgeAcrossReactRoots_UNSTABLE()

  useEffect(() => {
    console.log(blockProperties)
  }, [blockProperties])

  const { height, width } = useGetHW({
    maxH: bounds.height / 1.25,
    maxW: bounds.width / 1.25,
    aspectRatio: shortsMode ? 9 / 16 : 16 / 9,
  })

  const { height: divHeight, width: divWidth } = useGetHW({
    maxH: bounds.height / 1.25,
    maxW: bounds.width / 1.25,
    aspectRatio: 16 / 9,
  })

  Konva.pixelRatio = 2

  return (
    <div
      style={{
        height: divHeight,
        width: divWidth,
      }}
    >
      <Stage
        ref={stageRef}
        height={height}
        width={width}
        scale={{
          x: height / (shortsMode ? SHORTS_CONFIG.height : CONFIG.height),
          y: width / (shortsMode ? SHORTS_CONFIG.width : CONFIG.width),
        }}
      >
        <Bridge>
          <Layer ref={layerRef}>
            <Rect
              x={0}
              y={0}
              width={width}
              height={height}
              fillLinearGradientStartPoint={
                blockProperties.gradient?.startIndex
              }
              fillLinearGradientEndPoint={blockProperties.gradient?.endIndex}
              fillLinearGradientColorStops={blockProperties.gradient?.values}
            />
            <UnifiedFragment
              stageRef={stageRef}
              layerRef={layerRef}
              layoutConfig={config}
              config={[block]}
            />
          </Layer>
        </Bridge>
      </Stage>
    </div>
  )
}

const PreviewModal = ({
  open,
  block,
  config,
  blockProperties,
  shortsMode,
  updateBlockProperties,
  handleClose,
}: {
  block: Block
  open: boolean
  config: ViewConfig
  blockProperties: BlockProperties
  shortsMode: boolean
  updateBlockProperties: (id: string, properties: BlockProperties) => void
  handleClose: () => void
}) => {
  const [ref, bounds] = useMeasure()
  const [tab, setTab] = useState<Tab>(previewTabs[0])

  const updateLayout = (layout: Layout) => {
    updateBlockProperties(block.id, { ...blockProperties, layout })
  }

  const updateGradient = (gradient: GradientConfig) => {
    updateBlockProperties(block.id, { ...blockProperties, gradient })
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      center
      styles={{
        modal: {
          maxWidth: '80%',
          width: '100%',
          maxHeight: '80vh',
          height: '100%',
        },
      }}
      classNames={{
        modal: cx(
          'rounded-lg',
          css`
            background-color: #fffffff !important;
          `
        ),
        closeButton: css`
          svg {
            fill: #000000;
          }
        `,
      }}
      ref={ref}
    >
      <div className="py-8 px-4 flex justify-between items-start">
        <CanvasPreview
          bounds={bounds}
          block={block}
          config={config}
          shortsMode={shortsMode}
          blockProperties={blockProperties}
        />
        <div className="px-4">
          <TabBar
            tabs={previewTabs}
            current={tab}
            onTabChange={(tab) => setTab(tab)}
            className="mb-4"
          />
          {tab.value === previewTabs[0].value && (
            <LayoutSelector
              layout={blockProperties.layout || allLayoutTypes[0]}
              updateLayout={updateLayout}
              type={block.type}
            />
          )}
          {tab.value === previewTabs[1].value && (
            <GradientSelector
              currentGradient={
                blockProperties.gradient || getGradientConfig(gradients[0])
              }
              updateGradient={updateGradient}
            />
          )}
        </div>
      </div>
    </Modal>
  )
}

const BlockPreview = ({
  config,
  block,
  updateConfig,
}: {
  block: Block
  config: ViewConfig
  updateConfig: (id: string, properties: BlockProperties) => void
}) => {
  const [previewModal, setPreviewModal] = useState(false)
  const [ref, bounds] = useMeasure()

  if (!block || !config.blocks[block.id]) return null

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onKeyDown={() => null}
        onClick={() => setPreviewModal(true)}
        className="h-48 w-44"
        ref={ref}
      >
        <CanvasPreview
          block={block}
          bounds={bounds}
          shortsMode={config.mode === 'Portrait'}
          config={config}
          blockProperties={config.blocks[block.id]}
        />
      </div>
      <PreviewModal
        block={block}
        blockProperties={config.blocks[block.id]}
        updateBlockProperties={updateConfig}
        config={config}
        open={previewModal}
        shortsMode={config.mode === 'Portrait'}
        handleClose={() => {
          setPreviewModal(() => false)
        }}
      />
    </>
  )
}

export default BlockPreview
