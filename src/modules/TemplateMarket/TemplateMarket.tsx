import React, { useState } from 'react'
import Modal from 'react-responsive-modal'
import { useRecoilState } from 'recoil'
import { Button } from '../../components'
import { fragmentTemplateStore } from '../../stores/fragment.store'
import { Templates } from './Templates/SplashTemplates'

const TemplateMarket = ({
  open,
  setOpen,
  fragmentId,
  fragmentType,
}: {
  open: boolean
  setOpen: (open: boolean) => void
  fragmentId: string
  fragmentType: string
}) => {
  const [selectedTemplates, setSelectedTemplates] = useRecoilState(
    fragmentTemplateStore
  )

  const [selectedTemplate, setSelectedTemplate] = useState<string>()

  const handleTemplate = () => {
    if (!selectedTemplate) return

    setSelectedTemplates([
      ...selectedTemplates,
      { id: fragmentId, template: selectedTemplate },
    ])

    setOpen(false)
  }

  return (
    <Modal
      classNames={{
        modal: 'w-full',
        closeButton: 'focus:outline-none',
      }}
      open={open}
      onClose={() => setOpen(false)}
      center
    >
      <h2 className="text-center text-2xl">Choose a {fragmentType} Template</h2>
      <div className="grid grid-cols-3 gap-3 mt-3">
        {Templates.splash.map((temp) => (
          <button
            type="button"
            key={temp.name}
            onClick={() => setSelectedTemplate(temp.name)}
            className={`${
              selectedTemplate === temp.name && 'bg-blue-200'
            } cursor-pointer bg-blue-100 h-20 flex justify-center items-center`}
          >
            {temp.name}
          </button>
        ))}
      </div>
      <Button
        onClick={handleTemplate}
        className="mt-4 w-full"
        type="button"
        appearance="primary"
      >
        Select
      </Button>
    </Modal>
  )
}

export default TemplateMarket
