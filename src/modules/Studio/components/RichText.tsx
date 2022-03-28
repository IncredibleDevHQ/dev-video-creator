import Konva from 'konva'
import React, { useEffect, useState } from 'react'
import { Group, Rect, Text } from 'react-konva'
import { RichTextContent } from '../../Flick/editor/utils/utils'

export interface ComputedRichText {
  x: number
  y: number
  text: string
  width: number
  height?: number
  styles: string[]
}

const getRichTextData = ({
  content,
  fontSize = 12,
  fontFamily,
  width,
  lineHeight = 1,
}: {
  content: {
    type: 'richText' | 'text'
    content: RichTextContent | string
    line: number
  }[]
  width: number
  fontSize?: number
  fontFamily?: string
  lineHeight?: number
}) => {
  const layer = new Konva.Layer({ width })
  const computedRichText: ComputedRichText[] = []
  let currentX = 0
  let currentY = 0
  content.forEach((item) => {
    if (item.type === 'richText') {
      const richText = (item?.content as RichTextContent)?.text
      const styles = (item?.content as RichTextContent)?.marks

      if (styles.includes('code')) {
        const konvaText = new Konva.Text({
          text: richText,
          fontSize: fontSize * 0.6,
          fontFamily,
          fontStyle: styles
            .filter((style) => style === 'bold' || style === 'italic')
            .join(' '),
          lineHeight,
        })
        layer.add(konvaText)
        const textWidth = konvaText.textWidth + 10 + 8
        if (textWidth + currentX > width) {
          currentX = 0
          currentY += fontSize + fontSize * lineHeight
        }
        computedRichText.push({
          x: currentX,
          y: currentY,
          text: richText,
          width: textWidth - 8,
          styles,
        })
        currentX += textWidth
        konvaText.destroy()
      } else {
        richText?.split(' ').forEach((text) => {
          const konvaText = new Konva.Text({
            text: `${text} `,
            fontSize,
            fontFamily,
            fontStyle: styles
              .filter((style) => style === 'bold' || style === 'italic')
              .join(' '),
            lineHeight,
          })
          layer.add(konvaText)
          const { textWidth } = konvaText
          if (textWidth + currentX > width) {
            currentX = 0
            currentY += fontSize + fontSize * lineHeight
          }
          computedRichText.push({
            x: currentX,
            y: currentY,
            text: `${text} `,
            width: textWidth,
            styles,
          })

          currentX += textWidth
          konvaText.destroy()
        })
      }
    } else {
      const regularText = item?.content as string
      regularText?.split(' ').forEach((text) => {
        const konvaText = new Konva.Text({
          text: `${text} `,
          fontSize,
          fontFamily,
          lineHeight,
        })
        layer.add(konvaText)
        const { textWidth } = konvaText
        if (textWidth + currentX > width) {
          currentX = 0
          currentY += fontSize + fontSize * lineHeight
        }
        computedRichText.push({
          x: currentX,
          y: currentY,
          text: `${text} `,
          width: textWidth,
          styles: [],
        })

        currentX += textWidth
        konvaText.destroy()
      })
    }
  })
  return computedRichText
}

const RichText = ({
  content,
  x,
  y,
  width = 960,
  height,
  align = 'left',
  fontSize = 12,
  fontFamily,
  fill = '#000000',
  lineHeight = 1,
}: {
  content: {
    type: 'richText' | 'text'
    content: RichTextContent | string
    line: number
  }[]
  x?: number
  y?: number
  width?: number
  height?: number
  align?: 'left' | 'center' | 'right'
  fontSize?: number
  fontFamily?: string
  fill?: string
  lineHeight?: number
}) => {
  const [computedRichText, setComputedRichText] = useState<ComputedRichText[]>(
    []
  )
  useEffect(() => {
    setComputedRichText(
      getRichTextData({ content, width, fontSize, fontFamily, lineHeight })
    )
  }, [content])

  return (
    <Group x={x} y={y}>
      <>
        {computedRichText.map((item) => {
          if (item.styles.includes('code')) {
            return (
              <Group x={item.x} y={item.y}>
                <Rect
                  width={item.width}
                  height={fontSize}
                  //   fill="#F3F4F6"
                  fill="#000000"
                  cornerRadius={4}
                />
                <Text
                  x={5}
                  y={fontSize * 0.2}
                  text={item.text}
                  width={item.width - 10}
                  align="center"
                  fill="#ffffff"
                  fontSize={fontSize * 0.6}
                  fontFamily={fontFamily}
                  fontStyle={item.styles
                    .filter((style) => style === 'bold' || style === 'italic')
                    .join(' ')}
                />
              </Group>
            )
          }
          return (
            <Text
              x={item.x}
              y={item.y}
              text={item.text}
              fontSize={fontSize}
              fontFamily={fontFamily}
              fontStyle={item.styles
                .filter((style) => style === 'bold' || style === 'italic')
                .join(' ')}
              fill={fill}
            />
          )
        })}
      </>
    </Group>
  )
}

export default RichText
