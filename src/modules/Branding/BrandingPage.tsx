/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */

import React, { useEffect, useMemo, useState } from 'react'
import Skeleton from 'react-loading-skeleton'
import { cx } from '@emotion/css'
import { useRecoilValue } from 'recoil'
import { Navbar, Text } from '../../components'
import {
  GetBrandingQuery,
  useCreateBrandingMutation,
  useGetBrandingLazyQuery,
} from '../../generated/graphql'
import { userState } from '../../stores/user.store'
import Branding2 from './Branding'

const BrandTile = (props: {
  branding: BrandingInterface
  active?: boolean
  handleClick?: () => void
}) => {
  return (
    <div
      className={cx(
        'shadow-xl cursor-pointer bg-white px-2 py-4 rounded border-1.5',
        {
          'border-brand': props.active,
        }
      )}
      onClick={props.handleClick}
    >
      <h3>{props.branding.name}</h3>
      <div className="flex gap-x-4 mt-2">
        <div className="flex -space-x-2">
          {props.branding.branding?.colors?.primary && (
            <span
              style={{ background: props.branding.branding.colors.primary }}
              className="w-6 h-6 rounded-full"
            />
          )}
          {props.branding.branding?.colors?.secondary && (
            <span
              style={{ background: props.branding.branding.colors.secondary }}
              className="w-6 h-6 rounded-full"
            />
          )}
          {props.branding.branding?.colors?.tertiary && (
            <span
              style={{ background: props.branding.branding.colors.tertiary }}
              className="w-6 h-6 rounded-full"
            />
          )}
        </div>
        {props.branding.branding?.logo && (
          <img
            className="w-6 h-6 rounded"
            src={props.branding.branding.logo}
            alt="Logo"
          />
        )}
      </div>
    </div>
  )
}

export interface BrandingJSON {
  colors?: {
    primary?: string
    secondary?: string
    tertiary?: string
  }
  logo?: string
  companyName?: string
  font?: string
}

const initialValue: BrandingJSON = {
  colors: { primary: '#000', secondary: '#ccc', tertiary: '#eee' },
  logo: '',
  companyName: '',
  font: '',
}

type B = GetBrandingQuery['Branding'][0]

export interface BrandingInterface extends B {
  branding?: BrandingJSON | null
}

const BrandingPage = () => {
  const [brandingId, setBrandingId] = useState<string>()

  const [brandings, setBrandings] = useState<BrandingInterface[]>([])

  const user = useRecoilValue(userState)

  const [getBranding, { data, loading: fetching, refetch }] =
    useGetBrandingLazyQuery()

  const [createBranding, { loading }] = useCreateBrandingMutation()

  const branding = useMemo(() => {
    return brandings.find((branding) => branding.id === brandingId)
  }, [brandings, brandingId])

  useEffect(() => {
    setBrandings(data?.Branding || [])

    if (!brandingId || !data?.Branding.find((b) => b.id === brandingId)) {
      setBrandingId(data?.Branding?.[0].id)
    }
  }, [data])

  useEffect(() => {
    if (!user?.sub) return

    getBranding()
  }, [user?.sub])

  const handleCreateBranding = async () => {
    const { data } = await createBranding({
      variables: { name: 'Untitled Branding', branding: initialValue },
    })
    await refetch()
    setBrandingId(data?.insert_Branding_one?.id)
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="my-4 mx-6">
        <Text className="font-semibold text-2xl mb-8">Branding</Text>

        {fetching || !user?.sub ? (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <Skeleton width={220} height={80} />
            <Skeleton width={220} height={80} />
            <Skeleton width={220} height={80} />
          </div>
        ) : (
          <div>
            {brandings.length === 0 && (
              <div className="my-3 bg-brand text-xs text-center rounded-md text-gray-100 p-2">
                You haven&apos;t setup any Branding yet. Branding helps you make
                your videos truly yours!
              </div>
            )}

            <div className="my-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 md:grid-cols-3 lg:grid-cols-4 mb-8">
                {brandings.map((branding) => (
                  <BrandTile
                    active={brandingId === branding.id}
                    handleClick={() => {
                      setBrandingId(branding.id)
                    }}
                    branding={branding}
                    key={branding.id}
                  />
                ))}
                <div
                  onClick={handleCreateBranding}
                  className="h-full cursor-pointer border flex items-center justify-center rounded bg-white shadow-xl border-brand border-dashed p-2"
                >
                  {loading ? 'Creating...' : 'Create Branding'}
                </div>
              </div>
              <hr />
            </div>

            {branding && (
              <Branding2
                branding={branding}
                setBranding={(branding) => {
                  setBrandings((brandings) => {
                    return brandings.map((b) =>
                      b.id === branding.id ? branding : b
                    )
                  })
                }}
                refetch={refetch}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default BrandingPage
