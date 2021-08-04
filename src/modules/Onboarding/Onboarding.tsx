import React, { useEffect, useState } from 'react'
import { useRecoilState } from 'recoil'
import * as yup from 'yup'
import { useDebounce } from 'use-debounce'
import { FiCheck, FiX } from 'react-icons/fi'
import { databaseUserState } from '../../stores/user.store'
import {
  Button,
  emitToast,
  Loader,
  Logo,
  ScreenState,
  TextField,
} from '../../components'
import {
  useIsUsernameAvailableLazyQuery,
  UserFragment,
  UsernameAvailabilityOutput,
  useSetOnboardingMutation,
  useUpdateOnboardingUserMutation,
} from '../../generated/graphql'

const initialErrors: Pick<UserFragment, 'displayName' | 'username'> = {
  displayName: '',
  username: '',
}

const validateCredentials = async (
  field: keyof Pick<UserFragment, 'displayName' | 'username'>,
  credential: string
): Promise<string | null> => {
  switch (field) {
    case 'displayName':
      return yup.string().required('No Name provided').validate(credential)
    case 'username':
      return yup.string().required('No Username provided.').validate(credential)
    default:
      return null
  }
}

const Onboarding = () => {
  const [user, setUser] = useRecoilState(databaseUserState)
  const [localUser, setLocalUser] = useState<
    Pick<UserFragment, 'displayName' | 'username'>
  >({
    displayName: '',
    username: '',
  })
  const [userErrors, setUserErrors] =
    useState<Pick<UserFragment, 'displayName' | 'username'>>(initialErrors)
  const [usernameAvailable, setUsernameAvailable] =
    useState<
      Pick<UsernameAvailabilityOutput, 'message' | 'suggestion' | 'valid'>
    >()
  const [loading, setLoading] = useState(true)
  const [debouncedUsername] = useDebounce(localUser.username, 500)

  const [
    isUsernameAvailable,
    {
      data: usernameAvailability,
      loading: usernameAvailabilityLoading,
      error: usernameAvailabilityError,
    },
  ] = useIsUsernameAvailableLazyQuery()
  const [
    updateOnboardingUserMutation,
    { loading: updateOnboardingUserLoading },
  ] = useUpdateOnboardingUserMutation()
  const [setOnboardingMutation, { loading: setOnboardingLoading }] =
    useSetOnboardingMutation()

  useEffect(() => {
    if (!user) return
    setLocalUser({
      displayName: user.displayName || '',
      username: user.username,
    })
    setLoading(false)
  }, [user])

  useEffect(() => {
    if (localUser.username === user?.username) {
      setUsernameAvailable({ ...usernameAvailable, valid: true })
    }
    ;(async () => {
      try {
        await Promise.all([
          validateCredentials('displayName', localUser?.displayName as string),
          validateCredentials('username', localUser?.username as string),
        ])
        setUserErrors(initialErrors)
      } catch (error: any) {
        setUserErrors({
          ...userErrors,
          [error.type ? 'displayName' : 'username']: error.message,
        })
      }
    })()
  }, [localUser])

  useEffect(() => {
    if (!debouncedUsername) return
    ;(async () => {
      isUsernameAvailable({
        variables: { username: localUser?.username as string },
      })
    })()
  }, [debouncedUsername])

  useEffect(() => {
    if (
      !usernameAvailability?.UsernameAvailability ||
      localUser.username === user?.username
    )
      return
    setUsernameAvailable(usernameAvailability.UsernameAvailability)
  }, [usernameAvailability, user])

  const handleCredentialChange = (
    field: keyof Pick<UserFragment, 'displayName' | 'username'>,
    value: string
  ) => {
    if (field === 'username') {
      setUsernameAvailable({ ...usernameAvailable, valid: true })
    }
    setLocalUser({ ...localUser, [field]: value })
  }

  const handleOnboarding = async () => {
    try {
      await updateOnboardingUserMutation({
        variables: {
          sub: user?.sub as string,
          username: localUser?.username as string,
          displayName: localUser?.displayName as string,
        },
      })
      await setOnboardingMutation()
      setUser({
        ...user,
        ...localUser,
        onboarded: true,
      } as Required<UserFragment>)
    } catch (error: any) {
      emitToast({
        title: "We couldn't sign you up",
        autoClose: false,
        type: 'error',
        description: `Click this toast to refresh and give it another try. (${error.code})`,
        onClick: () => window.location.reload(),
      })
    }
  }

  if (loading) return <ScreenState title="Just a jiffy..." loading />

  return (
    <div className="flex justify-center items-center min-h-screen">
      <div className="w-full md:w-80 bg-background-alt p-4 rounded-md flex flex-col items-center shadow-sm">
        <Logo size="large" className="mb-4" />
        <form className="w-full">
          <TextField
            label="Name"
            type="text"
            className="my-2"
            value={localUser?.displayName || ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              handleCredentialChange('displayName', e.target.value as string)
            }}
            caption={userErrors.displayName as string}
            required
          />
          <TextField
            label="Username"
            type="text"
            className="my-2"
            value={localUser?.username || ''}
            accessories={(() => {
              if (usernameAvailabilityLoading) return [<Loader />]
              if (!usernameAvailable) return undefined
              if (usernameAvailabilityError)
                return [<FiX className="text-error" />]
              return usernameAvailable.valid
                ? [<FiCheck className="text-success" />]
                : [<FiX className="text-error" />]
            })()}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              handleCredentialChange('username', e.target.value)
            }}
            caption={(() => {
              if (!usernameAvailable) return undefined
              return usernameAvailable.valid ? undefined : (
                <p className="text-sm">
                  {usernameAvailable.message as string} Wanna use{' '}
                  <span
                    role="button"
                    tabIndex={0}
                    className="font-semibold underline text-brand inline-block"
                    onKeyUp={() => {
                      setLocalUser({
                        ...localUser,
                        username: usernameAvailability?.UsernameAvailability
                          ?.suggestion as string,
                      })
                    }}
                    onClick={() => {
                      setLocalUser({
                        ...localUser,
                        username: usernameAvailability?.UsernameAvailability
                          ?.suggestion as string,
                      })
                    }}
                  >
                    {usernameAvailability?.UsernameAvailability?.suggestion}
                  </span>
                  ?
                </p>
              )
            })()}
          />
          <Button
            type="submit"
            className="my-2"
            appearance="primary"
            loading={updateOnboardingUserLoading || setOnboardingLoading}
            disabled={
              loading ||
              usernameAvailabilityLoading ||
              updateOnboardingUserLoading ||
              setOnboardingLoading
            }
            onClick={(e) => {
              e?.preventDefault()
              handleOnboarding()
            }}
          >
            Confirm
          </Button>
        </form>
      </div>
    </div>
  )
}

export default Onboarding

/**
 * TODO:
 * 1. Update UI with new design
 * 2. Add more fields for onboarding(optional)
 */
