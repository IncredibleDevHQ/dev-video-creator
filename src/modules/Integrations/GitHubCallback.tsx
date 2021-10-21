import React, { useEffect, useState } from 'react'
import { FiAlertCircle, FiLoader, FiX } from 'react-icons/fi'
import { useRecoilValue } from 'recoil'
import { useIntegrateGitHubMutation } from '../../generated/graphql'
import { useQuery } from '../../hooks'

const GitHubCallback = () => {
  const query = useQuery()
  const [integrateGitHub] = useIntegrateGitHubMutation()

  const [code, state] = [query.get('code'), query.get('state')]
  const [error, setError] = useState<string>()

  useEffect(() => {
    ;(async () => {
      if (code && state) {
        if (state !== localStorage.getItem('github-oauth-state')) {
          setError('Invalid state')
          return
        }
        const { errors } = await integrateGitHub({
          variables: { code, state },
        })

        if (errors) {
          setError(errors[0].message)
        } else {
          window.opener?.postMessage({ type: 'github', value: true }, '*')
          localStorage.removeItem('github-oauth-state')
          window.close()
        }
      } else {
        setError('Invalid request')
      }
    })()
  }, [])

  return (
    <div className="h-screen flex items-center justify-center flex-col">
      {error ? (
        <div className="flex items-center justify-center flex-col">
          <FiAlertCircle className="mb-2" />
          <p>{error}</p>
        </div>
      ) : (
        <div className="flex items-center justify-center flex-col">
          <h1 className="text-2xl font-bold mb-4">Authenticating</h1>
          <p>Incredible is validating your identity.</p>
          <p>Please wait...</p>

          <FiLoader className="animate-spin mt-2" />
        </div>
      )}
    </div>
  )
}

export default GitHubCallback
