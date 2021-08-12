import React, { useEffect, useState } from 'react'
import { useHistory } from 'react-router-dom'
import { Button, emitToast, Heading, TextField } from '../../components'
import { useCreateOrganisationMutation } from '../../generated/graphql'

// type SelectedUsers = {
//   value: FilteredUserFragment
//   label: string
// }

const NewOrganisation = () => {
  const [title, setTitle] = useState<string>('')
  // const [selectedUsers, setSelectedUsers] = useState<SelectedUsers[]>([])
  // const [search, setSearch] = useState<string>('')
  const history = useHistory()

  // const {
  //   data,
  //   error,
  //   loading: loadingSelect,
  // } = useGetFilteredUsersQuery({
  //   variables: {
  //     _ilike: `%${search}%`,
  //   },
  // })

  const [createOrganisationMutation, { error: createError, loading }] =
    useCreateOrganisationMutation()

  const createOrganisation = async () => {
    await createOrganisationMutation({
      variables: {
        slug: title,
      },
    })

    history.push('/organisations')
  }

  useEffect(() => {
    if (!createError) return
    emitToast({
      title: 'Error Occured',
      type: 'error',
      description: `Click this toast to refresh and give it another try.`,
      onClick: () => window.location.reload(),
    })
  }, [createError])

  return (
    <section className="w-full min-h-screen flex flex-col justify-center items-center">
      <Heading fontSize="large" className="text-5xl mb-12">
        Create Your New Organisation
      </Heading>
      <form className="shadow-md bg-background-alt w-full md:w-2/5 p-4 flex flex-col">
        <TextField
          label="Title"
          className="my-2"
          value={title}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setTitle(e.target.value)
          }
        />
        {/* <span className="text-xs pt-2">Add Members</span>
        <Select
          isLoading={loadingSelect}
          isMulti
          name="colors"
          options={
            search
              ? data?.User?.map((user: FilteredUserFragment) => {
                  const option = {
                    value: user,
                    label: user.displayName,
                  }
                  return option
                })
              : []
          }
          noOptionsMessage={() => 'Search a Name..'}
          className="basic-multi-select"
          classNamePrefix="select"
          onInputChange={(value: string) => setSearch(value)}
          onChange={(value) => setSelectedUsers(value as SelectedUsers[])}
        /> */}
        <Button
          loading={loading}
          type="submit"
          appearance="primary"
          className="my-2"
          onClick={(e) => {
            e?.preventDefault()
            createOrganisation()
          }}
        >
          Create
        </Button>
      </form>
    </section>
  )
}

export default NewOrganisation
