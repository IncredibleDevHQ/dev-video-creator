import { css, cx } from '@emotion/css'
import Konva from 'konva'
import React, { createRef, HTMLAttributes, useState } from 'react'
import { Layer, Stage } from 'react-konva'
import Modal from 'react-responsive-modal'
import useMeasure, { RectReadOnly } from 'react-use-measure'
import {
  useRecoilBridgeAcrossReactRoots_UNSTABLE,
  useRecoilValue,
} from 'recoil'
import { Preview, Timeline } from '.'
import {
  allLayoutTypes,
  BlockProperties,
  Gradient,
  GradientConfig,
  Layout,
  shortsLayoutTypes,
  ViewConfig,
} from '../../../utils/configTypes'
import { CONFIG, SHORTS_CONFIG } from '../../Studio/components/Concourse'
import UnifiedFragment from '../../Studio/effects/fragments/UnifiedFragment'
import { Block } from '../editor/utils/utils'
import { newFlickStore } from '../store/flickNew.store'
import LayoutGeneric from './LayoutGeneric'

export const gradients: Gradient[] = [
  {
    id: 1,
    angle: 90,
    values: [0, '#D397FA', 0.0001, '#D397FA', 1, '#8364E8'],
    cssString:
      'linear-gradient(90deg, #D397FA 0%, #D397FA 0.01%, #8364E8 100%)',
  },
  {
    id: 2,
    angle: 90,
    values: [0.0001, '#FFAFBD', 1, '#FFC3A0'],
    cssString: 'linear-gradient(90deg, #FFAFBD 0.01%, #FFC3A0 100%)',
  },
  {
    id: 3,
    angle: 90,
    values: [0.0001, '#8879B2', 1, '#EAAFC8'],
    cssString: 'linear-gradient(90deg, #8879B2 0.01%, #EAAFC8 100%)',
  },
  {
    id: 4,
    angle: 90,
    values: [0.0001, '#8BC6EC', 1, '#9599E2'],
    cssString: 'linear-gradient(90deg, #8BC6EC 0.01%, #9599E2 100%)',
  },
  {
    id: 5,
    angle: 43.58,
    values: [0.424, '#FBDA61', 0.9792, '#FF5ACD'],
    cssString: 'linear-gradient(43.58deg, #FBDA61 4.24%, #FF5ACD 97.92%)',
  },
  {
    id: 6,
    angle: 180,
    values: [0.0001, '#A9C9FF', 1, '#FFBBEC'],
    cssString: 'linear-gradient(180deg, #A9C9FF 0.01%, #FFBBEC 100%)',
  },
  {
    id: 7,
    angle: 226.32,
    values: [0.0001, '#FF3CAC', 0.524, '#784BA0', 1, '#2B86C5'],
    cssString:
      'linear-gradient(226.32deg, #FF3CAC -25.84%, #784BA0 40.09%, #2B86C5 100%)',
  },
  {
    id: 8,
    angle: 47.5,
    values: [0, '#74EBD5', 0.96, '#9FACE6'],
    cssString: 'linear-gradient(47.5deg, #74EBD5 0%, #9FACE6 96%)',
  },
  {
    id: 9,
    angle: 46.2,
    values: [0, '#85FFBD', 0.9802, '#FFFED3'],
    cssString: 'linear-gradient(46.2deg, #85FFBD 0%, #FFFED3 98.02%)',
  },
  {
    id: 10,
    angle: 42.22,
    values: [0.278, '#FBAB7E', 0.9837, '#F7CE68'],
    cssString: 'linear-gradient(42.22deg, #FBAB7E 2.78%, #F7CE68 98.37%)',
  },
  {
    id: 11,
    angle: 90,
    values: [0.0001, '#43CEA2', 1, '#548AC0'],
    cssString: 'linear-gradient(90deg, #43CEA2 0.01%, #548AC0 100%)',
  },
  {
    id: 12,
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

export const backgroundColors = ['#1F2937', '#ffffff']
export const opacityOptions = [0.5, 1]

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
    id: gradient.id,
    cssString: gradient.cssString,
    values: gradient.values,
    startIndex: { x: x1, y: y1 },
    endIndex: { x: x2, y: y2 },
  } as GradientConfig
}

export const useGetHW = ({
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

const scrollStyle = css`
  ::-webkit-scrollbar {
    display: none;
  }
`

export const LayoutSelector = ({
  type,
  mode,
  layout,
  updateLayout,
}: {
  layout: Layout
  mode: ViewConfig['mode']
  updateLayout: (layout: Layout) => void
  type: Block['type']
}) => {
  return (
    <div className={cx('h-full w-full overflow-y-scroll', scrollStyle)}>
      <div
        className={cx(
          'grid grid-cols-2 p-4 gap-4 overflow-scroll ',
          scrollStyle,
          {
            'w-full gap-2 grid-cols-3': mode === 'Portrait',
            'w-full gap-4': mode === 'Landscape',
          }
        )}
      >
        {mode === 'Landscape'
          ? allLayoutTypes?.map((layoutType) => (
              <div className="flex justify-center items-center">
                <LayoutGeneric
                  type={type}
                  key={layoutType}
                  mode={mode}
                  layout={layoutType}
                  isSelected={layout === layoutType}
                  onClick={() => updateLayout(layoutType)}
                />
              </div>
            ))
          : shortsLayoutTypes?.map((layoutType) => (
              <LayoutGeneric
                type={type}
                key={layoutType}
                mode={mode}
                layout={layoutType}
                isSelected={layout === layoutType}
                onClick={() => updateLayout(layoutType)}
              />
            ))}
      </div>
    </div>
  )
}

export const CanvasPreview = ({
  block,
  bounds,
  config,
  shortsMode,
  scale = 1,
}: {
  block: Block
  bounds: RectReadOnly
  shortsMode: boolean
  config: ViewConfig
  scale?: number
}) => {
  const stageRef = createRef<Konva.Stage>()
  const layerRef = createRef<Konva.Layer>()
  const Bridge = useRecoilBridgeAcrossReactRoots_UNSTABLE()
  const { flick } = useRecoilValue(newFlickStore)

  const { height, width } = useGetHW({
    maxH: bounds.height * scale,
    maxW: bounds.width * scale,
    aspectRatio: shortsMode ? 9 / 16 : 16 / 9,
  })

  const { height: divHeight, width: divWidth } = useGetHW({
    maxH: bounds.height * scale,
    maxW: bounds.width * scale,
    aspectRatio: shortsMode ? 9 / 16 : 16 / 9,
  })

  Konva.pixelRatio = 2

  return (
    <div
      style={{
        height: divHeight,
        width: divWidth,
      }}
      className="flex justify-center"
    >
      <Stage
        ref={stageRef}
        height={height}
        width={width}
        className={cx(
          'border border-gray-300',
          css`
            margin-top: -0.125rem;
          `
        )}
        scale={{
          x: height / (shortsMode ? SHORTS_CONFIG.height : CONFIG.height),
          y: width / (shortsMode ? SHORTS_CONFIG.width : CONFIG.width),
        }}
      >
        <Bridge>
          <Layer ref={layerRef}>
            <UnifiedFragment
              stageRef={stageRef}
              layoutConfig={config}
              config={[block]}
              branding={flick?.branding?.branding}
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
  blocks,
  config,
  updateBlockProperties,
  handleClose,
  setCurrentBlock,
}: {
  block: Block
  open: boolean
  config: ViewConfig
  blocks: Block[]
  updateBlockProperties: (id: string, properties: BlockProperties) => void
  setCurrentBlock: React.Dispatch<React.SetStateAction<Block | undefined>>
  handleClose: () => void
}) => {
  return (
    <Modal
      open={open}
      onClose={handleClose}
      center
      showCloseIcon={false}
      styles={{
        modal: {
          maxWidth: '90%',
          width: '100%',
          maxHeight: '85vh',
          height: '100%',
          padding: '0',
          position: 'relative',
        },
      }}
      classNames={{
        modal: cx('rounded-md m-0 p-0'),
      }}
    >
      <div className="flex flex-col h-full ">
        <Preview
          block={block}
          blocks={blocks}
          config={config}
          updateConfig={updateBlockProperties}
          setCurrentBlock={setCurrentBlock}
          centered
        />
        <Timeline
          blocks={blocks}
          currentBlock={block}
          setCurrentBlock={setCurrentBlock}
          persistentTimeline
          shouldScrollToCurrentBlock={false}
          showTimeline
          setShowTimeline={() => {}}
        />
      </div>
    </Modal>
  )
}

const BlockPreview = ({
  config,
  block,
  blocks,
  setCurrentBlock,
  updateConfig,
  className,
  ...rest
}: {
  block: Block
  config: ViewConfig
  blocks: Block[]
  setCurrentBlock: React.Dispatch<React.SetStateAction<Block | undefined>>
  updateConfig: (id: string, properties: BlockProperties) => void
} & HTMLAttributes<HTMLDivElement>) => {
  const [previewModal, setPreviewModal] = useState(false)
  const [ref, bounds] = useMeasure()

  return (
    <div className={className} {...rest}>
      {block.type !== 'introBlock' && block.type !== 'outroBlock' && (
        <div
          role="button"
          tabIndex={0}
          onKeyDown={() => null}
          onClick={() => setPreviewModal(true)}
          className="flex flex-1 w-full h-full border-none outline-none"
          ref={ref}
        >
          <CanvasPreview
            block={block}
            bounds={bounds}
            shortsMode={config.mode === 'Portrait'}
            config={config}
          />
        </div>
      )}
      {previewModal && (
        <PreviewModal
          block={block}
          blocks={blocks}
          setCurrentBlock={setCurrentBlock}
          updateBlockProperties={updateConfig}
          config={config}
          open={previewModal}
          handleClose={() => {
            setPreviewModal(() => false)
          }}
        />
      )}
    </div>
  )
}

export default BlockPreview
