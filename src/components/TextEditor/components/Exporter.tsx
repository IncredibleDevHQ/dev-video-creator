import { useHelpers } from '@remirror/react'
import { useMemo } from 'react'

const Exporter = ({
  state,
  handleUpdateJSON,
}: {
  state: any
  handleUpdateJSON: any
}) => {
  const { getJSON } = useHelpers()

  useMemo(() => {
    handleUpdateJSON(getJSON(state))
  }, [state])

  return null
}

export default Exporter
