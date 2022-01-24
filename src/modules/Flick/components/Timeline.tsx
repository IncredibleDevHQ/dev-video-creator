import { css, cx } from '@emotion/css'
import React, { useState } from 'react'
import { IoShapesOutline } from 'react-icons/io5'
import { useRecoilValue } from 'recoil'
import { ReactComponent as UserPlaceholder } from '../../../assets/StudioUser.svg'
import { Button, Text } from '../../../components'
import { BrandingInterface } from '../../Branding/BrandingPage'
import { Block } from '../editor/utils/utils'
import { newFlickStore } from '../store/flickNew.store'
import { FragmentTypeIcon } from './LayoutGeneric'

const Timeline = ({
  blocks,
  currentBlock,
  setCurrentBlock,
}: {
  blocks: Block[]
  currentBlock: Block | undefined
  setCurrentBlock: React.Dispatch<React.SetStateAction<Block | undefined>>
}) => {
  const [showTimeline, setShowTimeline] = useState(true)
  const { flick } = useRecoilValue(newFlickStore)

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
            {blocks
              ?.filter((b) => b.type !== 'outroBlock')
              .map((block: Block) => (
                <a
                  className={cx(
                    'flex items-center gap-x-3 border border-transparent',
                    {
                      'bg-dark-300 py-1.5 px-2 rounded-md':
                        block.type === 'introBlock',
                      'border border-brand':
                        block.type === 'introBlock' &&
                        block.id === currentBlock?.id,
                    }
                  )}
                  href={`#${block.id}`}
                  onClick={() => {
                    setCurrentBlock(block)
                  }}
                >
                  {block.type === 'introBlock' && (
                    <>
                      <div
                        className={cx(
                          'border border-dark-100 rounded-md flex justify-center items-center w-24 h-12 p-3 bg-dark-100'
                        )}
                      >
                        <UserPlaceholder className="w-full h-full" />
                      </div>
                      {flick?.branding &&
                        flick?.useBranding &&
                        (flick?.branding as BrandingInterface).branding
                          ?.introVideoUrl && (
                          <div
                            className={cx(
                              'border border-dark-100 rounded-md flex justify-center items-center w-24 h-12 p-3 bg-dark-100'
                            )}
                          >
                            <IoShapesOutline className="w-full h-full text-gray-400" />
                          </div>
                        )}
                    </>
                  )}
                  <div
                    className={cx(
                      'border border-brand rounded-md flex justify-center items-center w-24 h-12 p-2 ',
                      {
                        'bg-dark-100 border-dark-100':
                          block.type === 'introBlock',
                        'border-dark-100 ':
                          block.id !== currentBlock?.id &&
                          block.type !== 'introBlock',
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
