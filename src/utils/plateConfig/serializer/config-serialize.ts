import { TNode } from '@udecode/plate'
import { nanoid } from 'nanoid'

import {
  CodejamConfig,
  TriviaConfig,
  VideojamConfig,
  PointsConfig,
  ConfigType,
} from '../../configTypes'

import { defaultNodeTypes } from './types'

type FragmentConfig =
  | CodejamConfig
  | TriviaConfig
  | VideojamConfig
  | PointsConfig

export const serializeDataConfig = (nodeArray: TNode[]): FragmentConfig[] => {
  const config: FragmentConfig[] = []

  let heading = ''
  let context: any = null

  nodeArray.forEach((node) => {
    // console.log('-----------------------------------------')
    // console.log('Current context = ', JSON.stringify(context))
    // console.log('Current type = ', node.type)
    // console.log('Current heading = ', heading)

    if (node.type === defaultNodeTypes.heading[1]) {
      /* 
        ADD HEADING if used, since heading comes b4 object we cant directly add to context 
        */
      heading = node.children[0].text ? node.children[0].text : 'Untitled'
    } else if (
      context &&
      node.type === defaultNodeTypes.paragraph &&
      node.children[0].text
    ) {
      /* ADD NOTES only if a context is present */
      context.notes.push(node.children[0].text)
    }

    // check for different objects

    /* CODE JAM */
    else if (node.type === defaultNodeTypes.code_block) {
      if (context !== null) {
        // add to config and clean-up
        config.push(context)
        context = null
      }
      // extract necessary data from plate's node array
      const codeRaw = node.children
        .map((child: TNode) => {
          return child.children[0].text
        })
        .join('\n')
      context = {
        id: nanoid(),
        type: ConfigType.CODEJAM,
        title: heading || '',
        value: {
          code: codeRaw,
          gistURL: '',
          isAutomated: false,
          language: node.lang || 'js',
          explanations: [],
        },
        /* notes will be populated by the above check for `p`.
           This follows the assumption that note added only after
           the object are considered.
        */
        notes: [],
      } as CodejamConfig
    } else if (
      node.type === defaultNodeTypes.block_quote ||
      node.type === defaultNodeTypes.image
    ) {
      /* TRIVIA/SLIDES JAM */
      // add to config and clean-up
      if (context !== null) {
        config.push(context)
        context = null
      }
      // extract necessary data from plate's node array
      if (node.type === defaultNodeTypes.block_quote) {
        context = {
          id: nanoid(),
          type: ConfigType.TRIVIA,
          title: heading || '',
          value: node.children[0].text,
          notes: [],
        } as TriviaConfig
      } else if (node.type === defaultNodeTypes.image) {
        context = {
          id: nanoid(),
          type: ConfigType.TRIVIA,
          title: heading || '',
          value: { text: node.caption?.[0].text, image: node.url },
          notes: [],
        } as TriviaConfig
      }
    } else if (node.type === defaultNodeTypes.ul_list) {
      if (context !== null) {
        // add to config and clean-up
        config.push(context)
        context = null
      }
      /* POINTS JAM */
      // extract necessary data from plate's node array
      const pointsList: any[] = []
      node.children.forEach((li: any) =>
        pointsList.push({
          level: 0,
          text: li.children.map((lic: any) => {
            return lic.children[0].text
          })?.[0],
        })
      )
      context = {
        id: nanoid(),
        type: ConfigType.POINTS,
        title: heading || 'default',
        value: pointsList,
        notes: [],
      } as PointsConfig
    } else if (node.type === defaultNodeTypes.media_embed) {
      if (context !== null) {
        // add to config and clean-up
        config.push(context)
        context = null
      }
      /* VIDEO JAM */
      // extract necessary data from plate's node array
      context = {
        id: nanoid(),
        type: ConfigType.VIDEOJAM,
        title: heading || '',
        value: { videoURL: node.url },
      } as VideojamConfig
    }
  })

  // if last element then add all the details from context to config
  if (context) {
    context.title = heading
    config.push(context)
  }

  return config
}
