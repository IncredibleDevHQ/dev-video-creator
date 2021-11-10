import { TNode } from '@udecode/plate'
import axios from 'axios'

import { nanoid } from 'nanoid'
import * as gConfig from '../../../config'

import {
  CodejamConfig,
  TriviaConfig,
  VideojamConfig,
  PointsConfig,
  ConfigType,
  ColorCode,
} from '../../configTypes'

import { defaultNodeTypes } from './types'

// Helper function to extract comments from color-codes array

const isComment = (line: ColorCode) => {
  // TODO: Pick comment color based on the selected theme
  const commentColor = '#608B4E'
  if (line?.color === commentColor) {
    return true
  }
  return false
}

/*
  This function will remove the comments from the code and output 2 values:
  - A color codes array without the comments
  - A comment explanations array
*/
const commentExtractor = (tokens: ColorCode[]) => {
  const blockBuffer = []
  let tokenNumber = 0 // represents the token number of the original code
  let codeLineNumber = 0 // represents the line number of the code without comments
  let prevTokenLineNumber = 0 // represents the line number of the previously processed token
  const code: ColorCode[] = []

  while (tokenNumber < tokens.length) {
    let explanation: string | undefined
    let from: number | undefined
    let to: number | undefined

    // if the token is a comment
    if (isComment(tokens[tokenNumber])) {
      // extract the explanation and increment the token number
      // if (exp !== '' && !exp.match(/end$/g)) {
      explanation = tokens[tokenNumber].content.trim()
      // }

      tokenNumber += 1

      from = codeLineNumber
      // find the end of the comment block
      while (!isComment(tokens[tokenNumber]) && tokenNumber < tokens.length) {
        const codeToken = tokens[tokenNumber]
        // if line number has changed , increment code line number
        if (codeToken.lineNumber !== prevTokenLineNumber) {
          prevTokenLineNumber = codeToken.lineNumber
          codeLineNumber += 1
        }
        codeToken.lineNumber = codeLineNumber > 0 ? codeLineNumber - 1 : 0
        code.push(codeToken)
        tokenNumber += 1
      }
      to = codeLineNumber - 1
      // ignore the 2nd comment as it is only an indicator for end of block
      tokenNumber += 1
    } else {
      // If its a code token
      const codeToken = tokens[tokenNumber]
      // if line number has changed , increment code line number
      if (codeToken.lineNumber !== prevTokenLineNumber) {
        const diff = codeToken.lineNumber - prevTokenLineNumber
        prevTokenLineNumber = codeToken.lineNumber
        codeLineNumber += diff
      }
      codeToken.lineNumber = codeLineNumber > 0 ? codeLineNumber - 1 : 0
      code.push(codeToken)
      tokenNumber += 1
    }
    if (explanation && from !== undefined && to !== undefined) {
      blockBuffer.push({ explanation, from, to })
    }
  }
  return { blockBuffer, code }
}

type FragmentConfig =
  | CodejamConfig
  | TriviaConfig
  | VideojamConfig
  | PointsConfig

export const getColorCodes = async (
  codeRaw: string,
  lang: string,
  userToken: string
): Promise<ColorCode[]> => {
  let result: ColorCode[] = []

  // eslint-disable-next-line consistent-return
  try {
    const res = await axios.post(
      gConfig.default.hasura.server,
      {
        query: `
          query GetTokenisedCode(
            $code: String!
            $language: String!
            $theme: String
          ) {
            TokenisedCode(code: $code, language: $language, theme: $theme) {
              success
              data
            }
          }
        `,
        variables: {
          code: codeRaw,
          language: lang || 'javascript',
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${userToken}`,
        },
      }
    )

    if (res?.data?.data?.TokenisedCode?.success) {
      result = res?.data?.data?.TokenisedCode?.data
    }
  } catch (e) {
    console.error(e)
    throw e
  }

  return result
}

export const serializeDataConfig = async (
  nodeArray: TNode[],
  userToken: string
): Promise<FragmentConfig[]> => {
  const config: FragmentConfig[] = []

  let heading = ''
  let context: any = null

  // nodeArray.forEach(async (node) => {
  for (let i = 0; i < nodeArray.length; i += 1) {
    const node = nodeArray[i]
    // console.log('-----------------------------------------')
    // console.log('Current context = ', JSON.stringify(context))
    // console.log('Current type = ', node.type)
    // console.log('Current heading = ', heading)

    if (node.type === defaultNodeTypes.heading[1]) {
      /* 
        ADD HEADING if used, since heading comes b4 object we cant directly add to context 
        */
      heading = node.children?.[0]?.text ? node.children?.[0]?.text : 'Untitled'
    } else if (
      context &&
      node.type === defaultNodeTypes.paragraph &&
      node.children?.[0]?.text
    ) {
      /* ADD NOTES only if a context is present */
      context?.notes?.push(node.children?.[0]?.text)
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
          return child.children?.[0]?.text || child?.text
        })
        .join('\n')

      // get color codes
      // eslint-disable-next-line no-await-in-loop
      const colorCodes: ColorCode[] = await getColorCodes(
        `\n${codeRaw}`,
        node.lang,
        userToken
      )
      // Separate comments and code
      const { blockBuffer, code } = commentExtractor(colorCodes)

      // if explanations are detected set isAutomated to true
      let isAutomated = false
      if (blockBuffer?.length > 0) {
        isAutomated = true
      }

      context = {
        id: nanoid(),
        type: ConfigType.CODEJAM,
        title: heading || '',
        value: {
          code: codeRaw,
          gistURL: '',
          isAutomated,
          language: node.lang || 'javascript',
          explanations: blockBuffer,
          colorCodes: code,
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
          value: { text: node.children?.[0]?.text },
          notes: [],
        } as TriviaConfig
      } else if (node.type === defaultNodeTypes.image) {
        context = {
          id: nanoid(),
          type: ConfigType.TRIVIA,
          title: heading || '',
          value: { text: node.caption?.[0]?.text, image: node.url },
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
            return lic.children?.[0]?.text
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
  }

  // if last element then add all the details from context to config
  if (context) {
    context.title = heading
    config.push(context)
  }

  return config
}
