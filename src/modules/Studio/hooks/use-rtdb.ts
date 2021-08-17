import { useEffect, useState } from 'react'
import {
  ref,
  onValue,
  serverTimestamp,
  onDisconnect,
  set as setDatabase,
  Unsubscribe,
  update,
} from 'firebase/database'
import { useRecoilValue } from 'recoil'
import firebaseState from '../../../stores/firebase.store'

const isOfflineForDatabase = {
  online: false,
  lastChanged: serverTimestamp(),
}

const isOnlineForDatabase = {
  online: true,
  lastChanged: serverTimestamp(),
}

interface RTDBProps {
  // If lazy, we will not subscribe to the database as soon as we mount. Rather, we will return an executable function, for when you are ready!
  lazy?: boolean

  // Presence adds the ability of adding a presence system in place. You can also change the key name by defining the path key. If no path is provided, falls back to the global path. Default: false.
  presence?: { enabled?: boolean; path?: string }

  // Participants adds the ability of listening to changes on the participants path. You can also change the key name by defining the path key. If no path is provided, falls back to the global path. Default: false.
  participants?: { enabled?: boolean; path?: string; childPath?: string }

  // Path defines the path to the database.
  path: string

  // Set defines path to the payload parent.
  payload?: { enabled?: boolean; path?: string }
}

/**
 * This hook is used to set up all things realtime for Studio.
 *
 * @param {Object} props - The component props.
 *
 */
const useRTDB = <T, S>(
  props: RTDBProps
): {
  participants: T[] | null
  init: () => void
  updatePayload: (params: S) => void
  updateParticipant: (params: T) => void
  payload: S | null
} => {
  const { database } = useRecoilValue(firebaseState)

  const [participants, setParticipants] = useState<T[] | null>(null)
  const [payload, setPayload] = useState<S | null>(null)

  const [executable, setExecutable] = useState(!!!props.lazy)

  useEffect(() => {
    var unsubscribe: Unsubscribe | null = null

    if (props.participants?.enabled && executable) {
      const pathRef = ref(database, props.participants?.path || props.path)

      unsubscribe = onValue(pathRef, async (snapshot) => {
        setParticipants(snapshot.exists() ? snapshot.val() : null)
        console.log(snapshot)
      })
    }

    return () => {
      unsubscribe?.()
    }
  }, [props.participants?.enabled, executable])

  useEffect(() => {
    var unsubscribe: Unsubscribe | null = null

    if (props.payload?.enabled && executable) {
      const pathRef = ref(database, props.payload?.path || props.path)

      unsubscribe = onValue(pathRef, async (snapshot) => {
        setPayload(snapshot.exists() ? snapshot.val() : null)
        console.log(snapshot)
      })
    }

    return () => {
      unsubscribe?.()
    }
  }, [props.payload?.enabled, executable])

  useEffect(() => {
    var unsubscribe: Unsubscribe | null = null

    if (props.presence?.enabled && executable) {
      const presenceRef = ref(database, '.info/connected')
      const pathRef = ref(database, props.presence?.path || props.path)

      unsubscribe = onValue(
        presenceRef,
        (snapshot) => {
          if (snapshot.val() === true) {
            setDatabase(pathRef, isOnlineForDatabase)
          } else {
            setDatabase(pathRef, isOfflineForDatabase)
          }

          onDisconnect(pathRef).set(isOfflineForDatabase)
        },
        (error) => {
          console.error(error)
        }
      )
    }

    return () => {
      unsubscribe?.()
    }
  }, [props.presence?.enabled, executable])

  const init = () => {
    if (!!!props.lazy)
      throw Error(
        "The hook isn't lazy. To lazily use it, pass param lazy as true."
      )
    setExecutable(true)
  }

  const updatePayload = (value: S) => {
    const pathRef = ref(database, props.payload?.path || props.path)
    // @ts-ignore
    update(pathRef, value)
  }

  const updateParticipant = (value: T) => {
    const pathRef = ref(database, props.participants?.childPath || props.path)
    // @ts-ignore
    update(pathRef, value)
  }

  return { participants, init, updatePayload, payload, updateParticipant }
}

export { useRTDB }
