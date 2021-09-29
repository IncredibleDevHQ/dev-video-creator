import React, { useEffect, useState } from 'react'
import Modal from 'react-responsive-modal'
import { Button, emitToast, TextField, FileDropzone } from '../../../components'
import { useCreateOrganisationSeriesMutation } from '../../../generated/graphql'
import { useUploadFile } from '../../../hooks'
import { AllowedFileExtensions } from '../../../hooks/use-upload-file'

interface Props {
  seriesModal: boolean
  setSeriesModal: React.Dispatch<React.SetStateAction<boolean>>
  organisationSlug: string
  seriesCreated: boolean
  setSeriesCreated: React.Dispatch<React.SetStateAction<boolean>>
}

const seriesModal = ({
  seriesModal,
  setSeriesModal,
  organisationSlug,
  seriesCreated,
  setSeriesCreated,
}: Props) => {
  const [name, setName] = useState<string>()
  const [pic, setPic] = useState<string>()
  const [loadingPic, setLoadingPic] = useState<boolean>(false)

  const [uploadFile] = useUploadFile()

  const handleClick = async (file: File) => {
    if (!file) return

    setLoadingPic(true)
    const pic = await uploadFile({
      // @ts-ignore
      extension: file.name.split('.').pop() as AllowedFileExtensions,
      file,
    })
    setLoadingPic(false)
    setPic(pic.url)
  }

  const [CreateSeries, { loading, error }] =
    useCreateOrganisationSeriesMutation()

  const handleCreateSeries = async () => {
    await CreateSeries({
      variables: {
        name: name as string,
        organisationSlug,
        picture: pic as string,
      },
    })

    setSeriesCreated(!seriesCreated)
    setSeriesModal(false)
  }

  useEffect(() => {
    if (!error) return
    emitToast({
      title: "Couldn't create the series",
      type: 'error',
      description: `Click this toast to refresh and give it another try.`,
      onClick: () => window.location.reload(),
    })
  }, [error])

  return (
    <Modal
      classNames={{
        modal: 'w-full ',
        closeButton: 'focus:outline-none',
      }}
      open={seriesModal}
      onClose={() => setSeriesModal(false)}
      center
    >
      <div className="flex flex-col items-center justify-evenly h-full">
        <h2 className="text-3xl font-bold">Create a New Series</h2>
        <div className="flex w-2/3 flex-col flex-1 justify-around items-center">
          <TextField
            label="Name"
            className="my-2"
            value={name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setName(e.target.value)
            }
          />
          <FileDropzone
            className="w-full mb-2"
            typeof="image/*"
            // @ts-ignore
            onChange={(e) => e.target.files && handleClick(e.target.files?.[0])}
          />
          {pic && <img height="200px" src={pic} alt="series pic" />}
          <Button
            appearance="primary"
            type="button"
            onClick={handleCreateSeries}
            disabled={loadingPic}
            loading={loadingPic || loading}
          >
            Upload from System
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default seriesModal
