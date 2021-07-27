/**
 * A hook to trigger error boundary.
 */
// eslint-disable-next-line
import React, { useCallback, useState } from 'react'

const useCrash = () => {
  const [, setState] = useState()
  return useCallback(
    (err) =>
      setState(() => {
        throw err
      }),
    []
  )
}

export default useCrash
