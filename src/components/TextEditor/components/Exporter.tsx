import { useHelpers } from '@remirror/react'
import { useMemo } from 'react'

const Exporter = ({
  state,
  handleUpdateJSON,
  handleUpdateMarkdown,
}: {
  state: any
  handleUpdateJSON: any
  handleUpdateMarkdown: any
}) => {
  const { getJSON, getMarkdown } = useHelpers()

  useMemo(() => {
    handleUpdateJSON(getJSON(state))
    handleUpdateMarkdown(getMarkdown(state))
  }, [state])

  return null
}

export default Exporter
