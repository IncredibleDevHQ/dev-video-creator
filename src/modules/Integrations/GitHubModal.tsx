import React, { useEffect, useState } from 'react'
import { useFormik } from 'formik'
import axios from 'axios'
import * as Yup from 'yup'
import { cx, css } from '@emotion/css'
import { Modal } from 'react-responsive-modal'
import { BiLoader, BiSave } from 'react-icons/bi'
import { Button, Heading, Label } from '../../components'
import { useUpdateGitHubIntegrationMutation } from '../../generated/graphql'
import { GHBranch, GHRepo, GitHubResponse } from './types'

const GitHubSchema = Yup.object().shape({
  repository: Yup.string().required('Required'),
  branch: Yup.string().required('Required'),
})

const GitHubModal = ({
  handleClose,
  open,
  githubResponse,
}: {
  handleClose: (shouldRefetch?: boolean) => void
  open: boolean
  githubResponse?: GitHubResponse
}) => {
  const [updateGitHub, { loading }] = useUpdateGitHubIntegrationMutation()
  const [fetched, setFetched] = useState(false)
  const [loadingBranches, setLoadingBranches] = useState(false)

  const [githubData, setGithubData] = useState<{
    repos: GHRepo[]
    branches: GHBranch[]
  }>({
    repos: [],
    branches: [],
  })

  useEffect(() => {
    ;(async () => {
      if (githubResponse?.accessToken && !fetched) {
        const { data } = await axios.get(
          'https://api.github.com/user/repos?per_page=100',
          {
            headers: {
              Authorization: `token ${githubResponse?.accessToken}`,
            },
          }
        )

        setFetched(true)
        setGithubData((githubData) => ({ ...githubData, repos: data }))
      }
    })()
  }, [githubResponse])

  const { handleChange, handleSubmit, values, isValid, setValues, touched } =
    useFormik({
      initialValues: {
        repository: githubResponse?.repository || '',
        branch: githubResponse?.branch || '',
      },
      validationSchema: GitHubSchema,
      validateOnChange: true,
      onSubmit: async (values) => {
        await updateGitHub({
          variables: { ...values, id: githubResponse?.integrationId },
        })
        handleClose()
      },
    })

  useEffect(() => {
    ;(async () => {
      if (values.repository !== '') {
        setLoadingBranches(true)
        const { data } = await axios.get(
          `https://api.github.com/repos/${values.repository}/branches?per_page=100`,
          {
            headers: {
              Authorization: `token ${githubResponse?.accessToken}`,
            },
          }
        )

        setGithubData((githubData) => ({ ...githubData, branches: data }))
        setLoadingBranches(false)
        if (touched.repository) setValues({ ...values, branch: '' })
      }
    })()
  }, [values.repository])

  return (
    <Modal
      open={open}
      onClose={() => handleClose()}
      center
      classNames={{
        modal: cx(
          'rounded-lg w-auto md:w-1/2',
          css`
            background-color: #fffffff !important;
          `
        ),
        closeButton: css`
          svg {
            fill: #000000;
          }
        `,
      }}
    >
      <div>
        <div className="mx-4 my-2">
          <div className="flex items-center justify-between">
            <Heading fontSize="medium">Configure GitHub</Heading>
          </div>
          <div className="my-4 bg-gray-100 rounded-md px-2 py-4">
            Choose a GitHub repository to publish your Flick Markdowns to.
          </div>
          <div className="flex flex-col mt-4">
            <div className="mb-2 flex flex-col">
              <Label>Repository</Label>
              <select
                onChange={handleChange}
                name="repository"
                value={values.repository}
                className="p-2 border-gray-200 border rounded-md"
              >
                <option value="">Select a repository</option>
                {githubData.repos.map((repo) => (
                  <option key={repo.full_name} value={repo.full_name}>
                    {repo.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col">
              <Label className="flex items-center">
                Branch
                {loadingBranches && <BiLoader className="ml-1 animate-spin" />}
              </Label>
              <select
                onChange={handleChange}
                name="branch"
                value={values.branch}
                className="p-2 border-gray-200 border rounded-md"
              >
                <option value="">Select a branch</option>
                {githubData.branches.map((branch) => (
                  <option key={branch.name} value={branch.name}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-8 flex items-center justify-end">
              <Button
                icon={BiSave}
                type="button"
                appearance="primary"
                size="small"
                disabled={!isValid}
                onClick={() => handleSubmit()}
                loading={loading}
              >
                Update
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default GitHubModal
