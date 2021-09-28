/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable no-nested-ternary */
import React from 'react'
import Gravatar from 'react-gravatar'
import { FiEdit } from 'react-icons/fi'
import { IoCheckmarkDone } from 'react-icons/io5'
import { Link, useHistory, useParams } from 'react-router-dom'
import { Heading, Text } from '../../../components'
import { Icons } from '../../../constants'
import { useSeriesFlicksQuery } from '../../../generated/graphql'
import { NewFlickBanner } from '../../Dashboard/components'

const FlicksView = () => {
  const params: { id?: string } = useParams()
  const { data: seriesData } = useSeriesFlicksQuery({
    variables: {
      id: params.id,
    },
  })
  const history = useHistory()

  return (
    <div>
      <div className=" w-full gap-4">
        {seriesData?.Flick_Series.length === 0 && (
          <div className="flex flex-col justify-center items-center mt-5">
            <img src={Icons.EmptyState} alt="I" />
            <Text className="text-base mt-5">
              Uh-oh, you don&apos;t have any flicks yet.
            </Text>
            <NewFlickBanner seriesId={params.id} />
          </div>
        )}
      </div>
      {seriesData?.Flick_Series.map(
        (flick) =>
          !flick.flick?.deletedAt && (
            <Link to={`/flick/${flick.flick?.id}`}>
              <div
                key={flick.flick?.id}
                className="flex flex-col h-40 w-2/5 mb-7 bg-white"
              >
                <div className="flex flex-row w-full h-36">
                  <div className="w-64 flex items-center justify-center border-2">
                    <img src={Icons.flickIcon} alt="I" className="border-2" />
                  </div>
                  <div className="flex flex-col">
                    {flick.flick?.producedLink && (
                      <div
                        className="bg-green-300 h-5 w-24 ml-4 flex flex-row-1 items-center justify-center"
                        onClick={() => {
                          history.push(`/view/${flick.flick?.joinLink}`)
                        }}
                      >
                        <IoCheckmarkDone size={15} />
                        <Text className="text-green-700 text-sm pl-2">
                          Published
                        </Text>
                      </div>
                    )}

                    {!flick.flick?.producedLink && (
                      <div
                        style={{
                          background: '#FFEDD5',
                        }}
                        className="ml-4 flex flex-row max-w-min px-2 py-1 rounded-sm items-center justify-center"
                      >
                        <FiEdit size={12} style={{ color: '#C2410C' }} />
                        <Text className="text-red-700 text-xs pl-2">Draft</Text>
                      </div>
                    )}
                    <Heading className="text-lg md:capitalize font-bold pl-4 mt-5 w-40 truncate overflow-ellipsis">
                      {flick.flick?.name}
                    </Heading>
                    <div className="h-8 relative w-40">
                      <span
                        style={{ zIndex: 0 }}
                        className="top-0 left-0 w-8 h-8 rounded-full absolute animate-spin-slow "
                      />
                      <div className="z-10 mt-5 w-8 h-8 flex flex-row absolute top-1/2 transform -translate-x-1/2 -translate-y-1/2 left-6">
                        {flick.flick?.participants
                          .slice(0, 5)
                          .map((participant) =>
                            participant.user.picture ? (
                              <img
                                src={participant.user.picture as string}
                                alt="I"
                                className="w-8 h-8 rounded-full bg-gray-100"
                              />
                            ) : (
                              <Gravatar
                                className="w-8 h-8 rounded-full bg-gray-100"
                                email={participant.user.email as string}
                              />
                            )
                          )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-200 h-0.5 w-full mt-3" />
              </div>
            </Link>
          )
      )}
    </div>
  )
}

export default FlicksView
