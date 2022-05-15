import { css, cx } from '@emotion/css'
import React, { useEffect, useState } from 'react'
import {
  IoAddOutline,
  IoAlbumsOutline,
  IoCheckmarkCircle,
} from 'react-icons/io5'
import Modal from 'react-responsive-modal'
import { Button, emitToast, Heading, Text } from '../../../components'
import config from '../../../config'
import {
  CreateUserSeriesMutationVariables,
  useCreateUserSeriesMutation,
} from '../../../generated/graphql'

const defaults = {
  name: '',
  description: '',
}

const CreateSeriesModal = ({
  open,
  handleClose,
}: {
  open: boolean
  handleClose: (refresh?: boolean) => void
}) => {
  const [details, setDetails] =
    useState<CreateUserSeriesMutationVariables>(defaults)
  const [createSeries, { data, loading }] = useCreateUserSeriesMutation()

  const handleCreate = async () => {
    try {
      await createSeries({ variables: details })
    } catch (e) {
      emitToast({
        title: 'Could not create your series.Please try again',
        type: 'error',
        autoClose: 3000,
      })
    }
  }

  useEffect(() => {
    if (!data) return
    emitToast({
      title: 'Series created successfully',
      type: 'error',
      autoClose: 3000,
    })
    setDetails(defaults)
    // TODO: logEvent(PageEvent.SeriesCreated)
  }, [data])

  return (
    <Modal
      open={open}
      onClose={() => {
        setDetails(defaults)
        handleClose()
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
        <div
          className={cx(
            'flex flex-col w-full items-center justify-center',
            css`
              height: 50vh;
            `
          )}
        >
          <IoCheckmarkCircle size={128} className="mt-auto text-white" />
          <Text className="mt-12 text-center font-body text-white">
            Your series has been created. You can now add stories to it.
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
                `${config.auth.endpoint}/series/${details.name}--${data?.CreateSeries?.id}?new=true`,
                '_blank'
              )
            }}
          >
            Take me there
          </Button>
        </div>
      ) : (
        <form
          className={cx(
            'flex flex-col w-full',
            css`
              height: 50vh;
            `
          )}
        >
          <Heading className="py-2 text-gray-100" fontSize="medium">
            Let&apos;s create a series
          </Heading>
          <span className="mt-4 text-sm font-bold tracking-wide text-gray-100 font-main">
            Name your series
          </span>
          <input
            value={details.name}
            onChange={(e) => {
              setDetails({ ...details, name: e.currentTarget.value })
            }}
            placeholder="Series name"
            className="focus:border-brand w-full rounded-sm bg-dark-400 border border-transparent py-2.5 px-3 mt-1.5 focus:outline-none text-gray-100 text-sm"
          />
          <span className="mt-4 text-sm font-bold tracking-wide text-gray-100 font-main">
            Describe your series
          </span>
          <textarea
            value={details.description}
            onChange={(e) =>
              setDetails({ ...details, description: e.currentTarget.value })
            }
            placeholder="Description (optional)"
            className="w-full bg-dark-400 border border-transparent rounded-md py-3 px-3 mt-1.5 focus:outline-none focus:ring-0 focus:border-brand text-gray-100 text-sm flex-1 resize-none"
          />
          <Button
            type="submit"
            size="medium"
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
        </form>
      )}
    </Modal>
  )
}

const SeriesHeader = ({ refresh }: { refresh: () => void }) => {
  const [openCreate, setOpenCreate] = useState(false)

  return (
    <div>
      {/* <button
        type="button"
        className="bg-dark-400 rounded-md flex justify-between items-center p-3 cursor-pointer hover:bg-dark-300 active:bg-dark-200"
        onClick={() => {
          setOpenCreate(true)
        }}
      >
        <div className="p-2.5 rounded-sm bg-incredible-blue-light-600">
          <IoAlbumsOutline size={24} className="text-incredible-blue-600" />
        </div>
        <div className="flex-1 mx-4 flex flex-col items-start gap-y-1">
          <Heading fontSize="base">Create Series</Heading>
          <Text className="text-dark-title" fontSize="normal">
            A new collection of stories
          </Text>
        </div>
        <div className="ml-4">
          <IoAddOutline size={16} className="text-dark-title" />
        </div>
      </button> */}
      <Button
        onClick={() => {
          setOpenCreate(true)
        }}
        size="small"
        appearance="primary"
        type="button"
      >
        <IoAlbumsOutline size={14} className="mr-2 my-1" />
        <span className="text-sm">Create New</span>
      </Button>
      {openCreate && (
        <CreateSeriesModal
          open={openCreate}
          handleClose={(shouldRefresh) => {
            setOpenCreate(false)
            if (shouldRefresh) refresh()
          }}
        />
      )}
    </div>
  )
}

export default SeriesHeader
