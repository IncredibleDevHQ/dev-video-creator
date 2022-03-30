import { useEffect, useState } from 'react'
import { ref, onValue, Unsubscribe, update } from 'firebase/database'
import { useRecoilValue } from 'recoil'
import firebaseState from '../../../stores/firebase.store'

interface RTDBProps {
  // If lazy, we will not subscribe to the database as soon as we mount. Rather, we will return an executable function, for when you are ready!
  lazy?: boolean

  // Path defines the path to the database.
  path: string

  // Set defines path to the blocks parent.
  blocks?: { enabled: boolean; path?: string }
}

/**
 * This hook is used to set up all things realtime for Studio.
 *
 * @param {Object} props - The component props.
 *
 */
const useRTDB = <S>(
  props: RTDBProps
): {
  init: () => void
  updateBlocks: (params: S) => void
  blocks: S | null
} => {
  const { database } = useRecoilValue(firebaseState)

  const [executable, setExecutable] = useState(!props.lazy)
  const [blocks, setBlocks] = useState<S | null>(null)

  useEffect(() => {
    let unsubscribe: Unsubscribe | null = null

    if (props.blocks?.enabled && executable) {
      const pathRef = ref(database, props.blocks?.path || props.path)

      unsubscribe = onValue(pathRef, async (snapshot) => {
        setBlocks(snapshot.exists() ? snapshot.val() : null)
        console.log(snapshot)
      })
    }

    return () => {
      unsubscribe?.()
    }
  }, [props.blocks?.enabled, executable])

  const init = () => {
    if (!props.lazy)
      throw Error(
        "The hook isn't lazy. To lazily use it, pass param lazy as true."
      )
    setExecutable(true)
  }

  const updateBlocks = (value: S) => {
    const pathRef = ref(database, props.blocks?.path || props.path)
    // @ts-ignore
    update(pathRef, value)
  }

  return { init, updateBlocks, blocks }
}

export { useRTDB }
