import { css, cx } from '@emotion/css'
import React from 'react'
import Modal from 'react-responsive-modal'
import { useHistory } from 'react-router-dom'
import { Button, Heading, Text } from '../../../components'
import { ViewConfig } from '../../../utils/configTypes'
import { Block, SimpleAST } from '../editor/utils/utils'
import Timeline from './Timeline'

const RecordingModal = ({
  open,
  activeFragmentId,
  simpleAST,
  handleClose,
  currentBlock,
  config,
  setCurrentBlock,
}: {
  open: boolean
  simpleAST: SimpleAST | undefined
  activeFragmentId: string
  currentBlock: Block | undefined
  config: ViewConfig
  setCurrentBlock: React.Dispatch<React.SetStateAction<Block | undefined>>
  handleClose: (refresh?: boolean) => void
}) => {
  const history = useHistory()

  return (
    <Modal
      open={open}
      onClose={handleClose}
      center
      classNames={{
        modal: cx(
          'rounded-lg w-1/2 max-w-md mx-auto p-4',
          css`
            background-color: #ffffff !important;
          `
        ),
      }}
    >
      <Heading fontSize="medium">Block by block recording</Heading>
      <hr />
      <div className="text-center py-4">
        <Text>Select blocks to start recording</Text>
        <Text fontSize="small">
          You can always come back and record the rest of the blocks
        </Text>
      </div>
      <Timeline
        showTimeline
        persistentTimeline
        blocks={simpleAST?.blocks || []}
        setShowTimeline={() => {}}
        currentBlock={currentBlock}
        setCurrentBlock={setCurrentBlock}
        shouldScrollToCurrentBlock
        config={config}
      />
      <hr />
      <div className="flex justify-between items-center pt-4 px-2 text-black">
        <Button type="button" appearance="none" onClick={() => handleClose()}>
          Cancel
        </Button>
        <Button
          type="button"
          appearance="primary"
          onClick={() => history.push(`/${activeFragmentId}/studio`)}
        >
          Record Block
        </Button>
      </div>
    </Modal>
  )
}

export default RecordingModal
