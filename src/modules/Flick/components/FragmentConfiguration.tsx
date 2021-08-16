/* eslint-disable react/jsx-pascal-case */
import React from 'react'
import { EmptyState } from '../../../components'
import { FlickFragmentFragment } from '../../../generated/graphql'
// import { BasicTemplate } from '../../Studio/effects/Templates/SplashTemplates'

const FragmentConfiguration = ({
  fragment,
}: {
  fragment: FlickFragmentFragment | undefined
}) => {
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

  if (!fragment) return <EmptyState text="No fragment Selected" width={400} />
  return <div className="h-96">{fragment?.type}</div>
}

export default FragmentConfiguration
