import { css, cx } from '@emotion/css'
import React, { useState } from 'react'
import { Button, Text } from '../../../components'
import { Block } from '../editor/utils/utils'
import { FragmentTypeIcon } from './LayoutGeneric'

const Timeline = ({
  blocks,
  currentBlock,
}: {
  blocks: Block[]
  currentBlock: Block | undefined
}) => {
  const [showTimeline, setShowTimeline] = useState(false)

  return (
    <div className="fixed bottom-0 left-0 w-full">
      <Button
        appearance="gray"
        type="button"
        size="small"
        className={cx(
          'm-4 hover:bg-gray-700',
          css(`
            --tw-bg-opacity: 1;
            background-color: rgba(17, 24, 39, var(--tw-bg-opacity));
        `)
        )}
        onClick={() => setShowTimeline(!showTimeline)}
      >
        <Text className="text-sm">
          {showTimeline ? 'Close timeline' : 'Open timeline'}
        </Text>
      </Button>

      {showTimeline && (
        <div className="flex">
          <div className="h-24" />
          <div className="flex items-center w-full bg-dark-500 py-4 px-5 gap-x-4">
            {blocks?.map((block: Block) => (
              <a href={`#${block.id}`}>
                <div
                  className={cx(
                    'border border-brand rounded-md flex justify-center items-center w-24 h-12 p-2',
                    {
                      'border-dark-100 ': block.id !== currentBlock?.id,
                    }
                  )}
                >
                  <FragmentTypeIcon type={block.type} />
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default Timeline
