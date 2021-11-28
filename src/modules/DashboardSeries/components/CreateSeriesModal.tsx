import { css, cx } from '@emotion/css'
import React, { useEffect, useState } from 'react'
import Modal from 'react-responsive-modal'
import { useHistory } from 'react-router-dom'
import { Button, ScreenState, TextField } from '../../../components'
import { useCreateUserSeriesMutation } from '../../../generated/graphql'

const CreateSeriesModal = ({
  open,
  handleClose,
}: {
  open: boolean
  handleClose: (refresh?: boolean) => void
}) => {
  const [seriesName, setSeriesName] = useState('')
  const history = useHistory()

  const [createSeriesMutation, { data, loading, error }] =
    useCreateUserSeriesMutation()

  const handleAddSeries = async () => {
    await createSeriesMutation({
      variables: {
        name: seriesName,
        description: '',
      },
    })
  }

  useEffect(() => {
    if (!data) return

    history.push(`/series/${data.CreateSeries?.id}`)
    handleClose(false)
  }, [data])

  if (error)
    return (
      <ScreenState title="Something went wrong!!" subtitle={error?.message} />
    )

  if (loading) return <ScreenState title="Just a jiffy..." loading />

  return (
    <Modal
      open={open}
      onClose={() => {
        handleClose(true)
      }}
      classNames={{
        modal: cx(
          'rounded-lg w-auto md:w-1/2',
          css`
          background-color: #9ef7ff !important
          border: #02737d !important
    ;
        `
        ),
        closeButton: css`
          svg {
            fill: #000000;
          }
        `,
      }}
    >
      <TextField
        className="text-lg"
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          setSeriesName(e.target.value)
        }
        label="Series name"
      />
      <Button
        className="mt-3"
        appearance="primary"
        type="button"
        onClick={(e) => {
          e?.preventDefault()
          handleAddSeries()
        }}
        loading={loading}
      >
        Add Series
      </Button>
    </Modal>
  )
}

export default CreateSeriesModal
