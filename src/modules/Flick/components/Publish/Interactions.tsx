import React, { useContext, useEffect, useState } from 'react'
import Select, { OptionsType, ActionMeta } from 'react-select'
import { Heading, Text, TextField } from '../../../../components'
import { PublishContext } from './PublishFlick'

enum InteractionEnum {
  stackblitz = 'Stackblitz',
  codeSandbox = 'CodeSandbox',
  externalLink = 'External Link',
}

export interface Fragment {
  id: string
  name: string
}

export interface Interaction {
  interactionType: InteractionEnum
  url: string
  fragments: Fragment[]
}

const defaultInteractions: Interaction[] = [
  {
    interactionType: InteractionEnum.stackblitz,
    url: '',
    fragments: [],
  },
  {
    interactionType: InteractionEnum.codeSandbox,
    url: '',
    fragments: [],
  },
  {
    interactionType: InteractionEnum.externalLink,
    url: '',
    fragments: [],
  },
]

const InteractionCard = ({
  fragments,
  interaction,
  activeFragments,
  updateFragments,
  updateInteraction,
}: {
  fragments: Fragment[]
  activeFragments: Fragment[]
  interaction: Interaction
  updateFragments: (fragments: Fragment[]) => void
  updateInteraction: (interaction: Interaction) => void
}) => {
  return (
    <div className="border border-gray-200 rounded-md my-3 p-2">
      <span className="text-xs bg-gray-100 py-0.5 px-1 rounded-sm">
        {interaction.interactionType}
      </span>
      <Heading fontSize="small" className="font-bold mt-2">
        Add URL
      </Heading>
      <Text fontSize="small">
        {(() => {
          switch (interaction.interactionType) {
            case InteractionEnum.stackblitz:
              return 'Add Github or Stackblitz URL that you want to show as a Stackblitz interaction on your video'
            case InteractionEnum.codeSandbox:
              return 'Add codesandbox URL that you want to show as a Codesandbox interaction on your video'
            case InteractionEnum.externalLink:
              return 'Add any other custom external link to integrate on your video'
            default:
              return ''
          }
        })()}
      </Text>
      <TextField
        className="my-1"
        value={interaction.url}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          updateInteraction({ ...interaction, url: e.target.value })
        }
      />
      <Select
        options={fragments
          .filter((f) => !activeFragments.includes(f, 0))
          .map((f) => {
            return {
              label: f.name,
              value: f.id,
            }
          })}
        value={interaction.fragments.map((f) => {
          return { label: f.name, value: f.id }
        })}
        onChange={(
          selected: OptionsType<{
            label: string
            value: string
          }>,
          action: ActionMeta<{
            label: string
            value: string
          }>
        ) => {
          if (!selected) return
          if (action.action === 'select-option') {
            const selectedFragments = selected.map((s) =>
              fragments.find((f) => f.id === s.value)
            )
            updateInteraction({
              ...interaction,
              fragments: selectedFragments.filter((f) => f) as Fragment[],
            })
            updateFragments([
              ...activeFragments,
              ...(selectedFragments.filter((f) => f) as Fragment[]),
            ])
          }
          if (action.action === 'remove-value') {
            updateInteraction({
              ...interaction,
              fragments: interaction.fragments.filter(
                (f) => f.id !== action.removedValue.value
              ),
            })
            updateFragments(
              activeFragments.filter((f) => f.id !== action.removedValue.value)
            )
          }
        }}
        isMulti
      />
    </div>
  )
}

const Interactions = ({ fragments }: { fragments: Fragment[] }) => {
  const { interactions, setInteractions } = useContext(PublishContext)
  const [activeFragments, setActiveFragments] = useState<Fragment[]>([])

  useEffect(() => {
    setInteractions(defaultInteractions)
  }, [])

  const updateInteraction = (interaction: Interaction) => {
    const index = interactions.findIndex(
      (i) => i.interactionType === interaction.interactionType
    )
    if (index === -1) return
    const tempInteractions = [...interactions]
    tempInteractions.splice(index, 1, interaction)
    setInteractions(tempInteractions)
  }

  return (
    <div>
      <Text className="text-gray-600 text-sm">
        Add interactions like Stackblitz, CodeSandbox and forms in your post.
        Select the type of interactions and the fragments for it.
      </Text>
      {interactions.map((interaction) => (
        <InteractionCard
          key={interaction.interactionType}
          fragments={fragments}
          interaction={interaction}
          updateInteraction={updateInteraction}
          activeFragments={activeFragments}
          updateFragments={setActiveFragments}
        />
      ))}
    </div>
  )
}

export default Interactions
