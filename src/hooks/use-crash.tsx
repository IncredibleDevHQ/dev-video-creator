/**
 * A hook to trigger error boundary.
 */

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
