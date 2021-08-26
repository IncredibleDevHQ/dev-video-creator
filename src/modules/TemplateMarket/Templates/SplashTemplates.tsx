import React from 'react'
import { Layer, RegularPolygon, Stage } from 'react-konva'

const BasicTemplate = {
  attrs: { width: 578, height: 200 },
  className: Stage,
  children: [
    {
      attrs: {},
      className: Layer,
      children: [
        {
          attrs: {
            x: 100,
            y: 100,
            sides: 6,
            radius: 70,
            fill: 'red',
            stroke: 'black',
            strokeWidth: 4,
          },
          className: RegularPolygon,
        },
      ],
    },
  ],
}

// return (
//   <BasicTemplate.className {...BasicTemplate.attrs}>
//     {BasicTemplate.children.map((Layer) => (
//       <Layer.className {...Layer.attrs}>
//         {Layer.children.map((Child) => (
//           <Child.className {...Child.attrs} />
//         ))}
//       </Layer.className>
//     ))}
//   </BasicTemplate.className>
// )

// const BasicTemplate =
//   '{"attrs":{"width":578,"height":200},"className":"Stage","children":[{"attrs":{},"className":"Layer","children":[{"attrs":{"x":100,"y":100,"sides":6,"radius":70,"fill":"red","stroke":"black","strokeWidth":4},"className":"RegularPolygon"}]}]}'

const Templates = {
  splash: [
    {
      name: 'Splash',
    },
    {
      name: 'Splash2',
    },
  ],
}

export { BasicTemplate, Templates }
