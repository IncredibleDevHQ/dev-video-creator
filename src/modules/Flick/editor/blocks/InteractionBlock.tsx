import { mergeAttributes, Node } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react'
import React, { useState } from 'react'
import { IoInformationCircleOutline } from 'react-icons/io5'
import { ReactComponent as CommandCodeSandbox } from '../../../../assets/Command_CodeSandbox.svg'
import { ReactComponent as CommandReplit } from '../../../../assets/Command_Replit.svg'
import { ReactComponent as CommandStackBlitz } from '../../../../assets/Command_Stackblitz.svg'
import { Button, Heading, Tooltip } from '../../../../components'

export interface IframeOptions {
  allowFullscreen: boolean
  HTMLAttributes: {
    [key: string]: any
  }
}

const getTypeSpecifics = (
  type: string
): {
  name: string
  icon: React.ReactNode
  placeholder: string
} => {
  switch (type) {
    case 'stackblitz':
      return {
        name: 'StackBlitz',
        icon: <CommandStackBlitz className="w-full h-5" />,
        placeholder: 'https://stackblitz.com/edit/',
      }
    case 'codesandbox':
      return {
        name: 'CodeSandbox',
        icon: <CommandCodeSandbox className="w-full h-5" />,
        placeholder: 'https://codesandbox.io/s/',
      }
    case 'replit':
      return {
        name: 'Replit',
        icon: <CommandReplit className="w-full h-5" />,
        placeholder: 'https://repl.it/',
      }
    default:
      return {
        name: 'CodeSandbox',
        icon: <CommandCodeSandbox className="w-full h-5" />,
        placeholder: 'https://codesandbox.io/s/',
      }
  }
}

const UrlInput = ({ props }: { props: any }) => {
  const [url, setUrl] = useState<string>()

  return (
    <div
      style={{
        width: '450px',
      }}
      className="flex flex-col gap-y-4 bg-white border shadow-sm py-4 px-5 rounded-sm -mt-3"
    >
      <div className="flex items-center justify-between">
        <Heading className="font-bold text-base">
          Enter {getTypeSpecifics(props?.node?.attrs?.type).name} URL
        </Heading>
        <Button
          size="small"
          type="button"
          appearance="primary"
          onClick={() => {
            props.updateAttributes({
              src: url,
            })
          }}
        >
          Embed
        </Button>
      </div>
      <input
        className="bg-gray-100 border border-transparent py-2 px-2 rounded-sm w-full h-full focus:border-brand focus:outline-none font-body text-sm placeholder-gray-400"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder={getTypeSpecifics(props?.node?.attrs?.type).placeholder}
      />
    </div>
  )
}

const InteractionBlock = (props: any) => {
  const { src, type } = props.node.attrs

  const [isInputOpen, setInputOpen] = useState(false)

  return (
    <NodeViewWrapper className="my-3" id={props.node.attrs.id}>
      {src ? (
        <>
          <div className="flex items-center font-body text-xs gap-x-2 mb-1 text-gray-600">
            <IoInformationCircleOutline />
            Interactions are not part of your recording. It will be available in
            the video player for viewers
          </div>
          <iframe
            src={src}
            style={{
              width: '100%',
              height: '450px',
              border: '0',
              borderRadius: '4px',
            }}
            title="Interaction"
            allow="accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr-spatial-tracking;"
            sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
          />
        </>
      ) : (
        <Tooltip
          isOpen={isInputOpen}
          setIsOpen={setInputOpen}
          placement="bottom-start"
          content={<UrlInput props={props} />}
        >
          <button
            type="button"
            className="w-full bg-gray-100 rounded-sm flex items-center px-4 py-3 gap-x-2 text-gray-400 hover:bg-gray-200 cursor-pointer hover:text-gray-500 active:bg-gray-300 transition-all"
            onClick={() => setInputOpen(true)}
          >
            <div className="filter grayscale brightness-75">
              {getTypeSpecifics(type).icon}
            </div>
            <span className="font-body">Add {getTypeSpecifics(type).name}</span>
          </button>
        </Tooltip>
      )}
    </NodeViewWrapper>
  )
}

export default Node.create({
  name: 'interaction',

  group: 'block',

  atom: true,

  isolating: true,

  content: 'block*',

  addAttributes() {
    return {
      src: {
        default: null,
      },
      type: {
        default: null,
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'interaction',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['interaction', mergeAttributes(HTMLAttributes), 0]
  },

  addNodeView() {
    return ReactNodeViewRenderer(InteractionBlock, {})
  },
})
