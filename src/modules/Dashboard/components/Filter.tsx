import React from 'react'
import { sentenceCase } from 'change-case'
import { Button, Text } from '../../../components'

enum CollectionFilter {
  all = 'all',
  owner = 'owner',
  collaborator = 'collaborator',
}

enum StoryFilter {
  recorded = 'recorded',
  draft = 'draft',
}

const Filter = () => {
  return (
    <div className="flex justify-between items-center text-sm my-8">
      <div className="flex justify-start items-center">
        {Object.keys(CollectionFilter).map((key) => (
          <Text key={key} className="mr-2">
            {/* @ts-ignore */}
            {sentenceCase(CollectionFilter[key])}
          </Text>
        ))}
      </div>
      <div className="flex justify-end items-center">
        {Object.keys(StoryFilter).map((key) => (
          <Button
            type="button"
            appearance="secondary"
            size="extraSmall"
            className="ml-2"
            key={key}
          >
            {/* @ts-ignore */}
            {sentenceCase(StoryFilter[key])}
          </Button>
        ))}
      </div>
    </div>
  )
}

export default Filter
