import React, { useEffect, useState } from 'react'
import { css, cx } from '@emotion/css'
import Modal from 'react-responsive-modal'
import { IoCheckmarkCircle } from 'react-icons/io5'
import {
  CreateFlickFlickScopeEnumEnum,
  CreateNewFlickMutationVariables,
  useCreateNewFlickMutation,
} from '../../../generated/graphql'
import {
  Button,
  TextField,
  Heading,
  Text,
  emitToast,
} from '../../../components'

const defaults = {
  name: '',
  description: '',
  scope: CreateFlickFlickScopeEnumEnum.Public,
  configuration: {
    themeId: 0,
  },
}

const Success = ({
  handleClose,
  flickId,
  setDetails,
}: {
  handleClose: (refetch?: boolean) => void
  setDetails: React.Dispatch<
    React.SetStateAction<CreateNewFlickMutationVariables>
  >
  flickId: string
}) => {
  return (
    <div
      className={cx(
        'flex flex-col w-full items-center justify-center',
        css`
          height: 50vh;
        `
      )}
    >
      <IoCheckmarkCircle size={128} className="mt-auto" />
      <Text className="mt-4 text-center font-body text-dark-body-100">
        Your flick has been created. Click below to jump into the studio !
      </Text>
      <Button
        type="button"
        stretch
        appearance="primary"
        className="mt-auto"
        onClick={() => {
          setDetails(defaults)
          handleClose(true)
          window.open(
            `${process.env.NEXT_PUBLIC_STUDIO_ENDPOINT}/flick/${flickId}`,
            '_blank'
          )
        }}
      >
        Launch Flick Studio
      </Button>
    </div>
  )
}

const CreateFlickModal = ({
  open,
  handleClose,
  seriesId,
  handleRefresh,
}: {
  open: boolean
  handleClose: (refetch?: boolean) => void
  seriesId?: string
  handleRefresh?: () => void
}) => {
  const [details, setDetails] =
    useState<CreateNewFlickMutationVariables>(defaults)

  const [createFlick, { data, loading }] = useCreateNewFlickMutation()

  const handleCreate = async () => {
    try {
      if (seriesId) {
        await createFlick({
          variables: {
            ...details,
            seriesId,
          },
        })
      } else {
        await createFlick({ variables: details })
      }
    } catch (e) {
      emitToast({
        type: 'error',
        title: 'Could not create your flick.Please try again',
      })
    }
  }

  useEffect(() => {
    if (!data) return
    handleRefresh?.()
    emitToast({
      type: 'success',
      title: 'Flick created successfully',
    })
  }, [data])

  return (
    <Modal
      open={open}
      onClose={() => {
        setDetails(defaults)
        handleClose(!!data)
      }}
      styles={{
        modal: {
          maxWidth: '30%',
          maxHeight: '80%',
          width: '100%',
          backgroundColor: '#2E2F34',
        },
      }}
      classNames={{
        modal: cx(
          'rounded-md bg-dark-200 font-body',
          css`
            -ms-overflow-style: none;
            scrollbar-width: none;
            ::-webkit-scrollbar {
              display: none;
            }
          `
        ),
      }}
      center
      showCloseIcon={false}
    >
      {data ? (
        <Success
          handleClose={() => handleClose(true)}
          flickId={data.CreateFlick?.id}
          setDetails={setDetails}
        />
      ) : (
        <div
          className={cx(
            'flex flex-col w-full',
            css`
              height: 50vh;
            `
          )}
        >
          <Heading className="py-2 text-gray-100" fontSize="medium">
            Let&apos;s create a flick
          </Heading>
          <span className="mt-4 text-sm font-bold tracking-wide text-gray-100 font-main">
            Name your flick
          </span>
          <TextField
            label=""
            value={details.name}
            onChange={(e) => {
              setDetails({ ...details, name: e.currentTarget.value })
            }}
            placeholder="Flick name"
            className="w-full bg-dark-400 border-none py-3 px-3 mt-1.5 focus:outline-none text-gray-100 text-sm"
          />
          <span className="mt-4 text-sm font-bold tracking-wide text-gray-100 font-main">
            Describe your flick
          </span>
          <textarea
            value={details.description || ''}
            onChange={(e) =>
              setDetails({ ...details, description: e.currentTarget.value })
            }
            placeholder="Description (optional)"
            className="w-full bg-dark-400 border-none rounded-md py-3 px-3 mt-1.5 focus:outline-none text-gray-100 text-sm flex-1 resize-none"
          />
          <Button
            size="small"
            type="button"
            appearance="primary"
            className="mt-6"
            stretch
            loading={loading}
            disabled={!details.name}
            onClick={() => {
              if (!details.name) return
              handleCreate()
            }}
          >
            Create
          </Button>
        </div>
      )}
    </Modal>
  )
}

export default CreateFlickModal
