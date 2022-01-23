/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */

import React, { ChangeEvent, useCallback, useRef, useState } from 'react'
import FontPicker from 'font-picker-react'
import { HexColorInput, HexColorPicker } from 'react-colorful'
import { Button, Label, Text, TextField } from '../../components'
import config from '../../config'
import {
  useDeleteBrandingMutation,
  useUpdateBrandingMutation,
} from '../../generated/graphql'
import { useClickOutside, useUploadFile } from '../../hooks'
import { BrandingInterface } from './BrandingPage'

export const ColorPicker = ({ color, onChange }: any) => {
  const popover = useRef<HTMLDivElement | null>(null)
  const [isOpen, toggle] = useState(false)

  const close = useCallback(() => toggle(false), [])
  useClickOutside(popover, close)

  return (
    <div className="relative">
      <div
        className="w-16 h-16 md:w-24 md:h-24 rounded-full border-4 border-gray-200 shadow-lg cursor-pointer"
        style={{ backgroundColor: color }}
        onClick={() => toggle(true)}
      />

      {isOpen && (
        <div
          className="absolute left-0 rounded-lg shadow-xl z-10"
          style={{ top: 'calc(100% + 4px)' }}
          ref={popover}
        >
          <HexColorPicker color={color} onChange={onChange} />
        </div>
      )}
    </div>
  )
}

const ColorComponent = ({ color, onChange, label }: any) => {
  return (
    <div>
      <Label className="mb-4">{label}</Label>

      <div className="flex items-center">
        <ColorPicker color={color} onChange={onChange} />
        <HexColorInput
          color={color}
          className="ml-4 border w-full md:w-auto border-gray-300 focus:border-brand transition-colors focus:outline-none rounded p-2"
          onChange={onChange}
        />
      </div>
    </div>
  )
}

const Branding = ({
  branding,
  setBranding,
  refetch,
}: {
  branding: BrandingInterface
  setBranding: (branding: BrandingInterface) => void
  refetch: () => void
}) => {
  const handleUploadFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file: File | undefined = e.target.files?.[0]
    if (!file) return

    setFileUploading(true)
    const { url } = await uploadFile({
      extension: file.name.split('.').pop() as any,
      file,
    })

    setFileUploading(false)
    setBranding({ ...branding, branding: { ...branding.branding, logo: url } })
  }

  const [updateBranding, { loading }] = useUpdateBrandingMutation()
  const [deleteBrandingMutation] = useDeleteBrandingMutation()

  const [uploadFile] = useUploadFile()

  const [fileUploading, setFileUploading] = useState(false)

  const handleSave = async () => {
    await updateBranding({
      variables: {
        branding: branding.branding,
        name: branding.name,
        id: branding.id,
      },
    })
  }

  const deleteBranding = async () => {
    await deleteBrandingMutation({
      variables: {
        id: branding.id,
      },
    })

    refetch()
  }

  const inputRef = useRef<HTMLInputElement | null>(null)

  return (
    <>
      <div className="mb-6">
        <input
          className="p-2 -ml-2 bg-gray-100 w-full md:w-64 rounded focus:outline-none text-xl mb-4"
          placeholder="Name"
          value={branding?.name}
          onChange={(e) => {
            setBranding({ ...branding, name: e.target.value })
          }}
        />

        <Text className="font-semibold text-xl mb-4">Colors</Text>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 md:grid-cols-3">
          <ColorComponent
            label="Primary Color"
            color={branding.branding?.colors?.primary}
            onChange={(color: string) => {
              setBranding({
                ...branding,
                branding: {
                  ...branding.branding,
                  colors: {
                    ...branding.branding?.colors,
                    primary: color,
                  },
                },
              })
            }}
          />
          <ColorComponent
            label="Secondary Color"
            color={branding.branding?.colors?.secondary}
            onChange={(color: string) => {
              setBranding({
                ...branding,
                branding: {
                  ...branding.branding,
                  colors: {
                    ...branding.branding?.colors,
                    secondary: color,
                  },
                },
              })
            }}
          />
          <ColorComponent
            label="Tertiary Color"
            color={branding.branding?.colors?.tertiary}
            onChange={(color: string) => {
              setBranding({
                ...branding,
                branding: {
                  ...branding.branding,
                  colors: {
                    ...branding.branding?.colors,
                    tertiary: color,
                  },
                },
              })
            }}
          />
        </div>
      </div>
      <div className="mb-6">
        <Text className="font-semibold text-xl mb-4">Company</Text>
        <div className="md:w-80 mb-4 w-full">
          <Label>Company Name</Label>
          <TextField
            placeholder="Incredible"
            value={branding.branding?.companyName}
            onChange={(e: any) => {
              setBranding({
                ...branding,
                branding: {
                  ...branding.branding,
                  companyName: e.target.value,
                },
              })
            }}
          />
        </div>
        <div className="md:w-80 w-full">
          <Label>Logo</Label>
          <div className="flex items-center">
            <input
              accept="image/*"
              type="file"
              className="hidden"
              ref={inputRef}
              onChange={handleUploadFile}
            />
            <div
              style={{ background: branding.branding?.logo }}
              className="w-16 h-16 rounded-full bg-gray-200"
            >
              {branding.branding?.logo && (
                <img
                  className="w-16 h-16 rounded-full object-fill"
                  src={branding.branding.logo}
                  alt="Logo"
                />
              )}
            </div>
            <Button
              onClick={() => {
                inputRef.current?.click()
              }}
              appearance="link"
              type="button"
              size="small"
              disabled={fileUploading}
            >
              {fileUploading ? 'Uploading' : 'Choose file'}
            </Button>
          </div>
        </div>
      </div>
      <div className="mb-6">
        <div className="md:w-80 mb-4 w-full">
          <Label>Font</Label>
          {/* <FontPicker
            activeFontFamily={branding.branding?.font}
            onChange={(font) => {
              setBranding({
                ...branding,
                branding: {
                  ...branding.branding,
                  font: font.family,
                },
              })
            }}
            apiKey={config.googleFonts.apiKey}
          /> */}
        </div>
      </div>
      <div className="flex items-center gap-x-4">
        <Button
          onClick={handleSave}
          appearance="primary"
          type="button"
          size="small"
          loading={loading}
        >
          Save Changes
        </Button>
        {branding.branding && (
          <Button
            onClick={deleteBranding}
            appearance="danger"
            type="button"
            size="small"
          >
            Delete Branding
          </Button>
        )}
      </div>
    </>
  )
}

export default Branding
