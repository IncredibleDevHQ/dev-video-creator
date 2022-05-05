import { cx } from '@emotion/css'
import React, { useEffect, useState } from 'react'
import { FiLoader, FiMoreVertical } from 'react-icons/fi'
import { HiOutlineSparkles } from 'react-icons/hi'
import {
  IoAddOutline,
  IoChevronForwardOutline,
  IoCopyOutline,
  IoFolderOpenOutline,
  IoMenuOutline,
  IoPlayOutline,
  IoTrashOutline,
} from 'react-icons/io5'
import { MdOutlinePresentToAll } from 'react-icons/md'
import { Link, useHistory, useParams } from 'react-router-dom'
import { Button, emitToast, Text, Tooltip } from '../../../components'
import {
  Fragment_Type_Enum_Enum,
  GetFragmentListDocument,
  GetFragmentListQuery,
  GetFragmentListQueryVariables,
  useCreateFragmentMutation,
  useDeleteFragmentMutation,
  useDuplicateFragmentMutation,
  useGetFlickFragmentLazyQuery,
  useGetFragmentListQuery,
} from '../../../generated/graphql'
import { verticalCustomScrollBar } from '../../../utils/globalStyles'

const Sidebar = ({ storyName }: { storyName: string }): JSX.Element | null => {
  const { id, fragmentId } = useParams<{
    id: string
    fragmentId: string | undefined
  }>()

  const history = useHistory()

  const { data, error } = useGetFragmentListQuery({
    variables: {
      flickId: id,
    },
  })

  const [getFragment] = useGetFlickFragmentLazyQuery()

  const [createFragment, { loading: creatingFragment }] =
    useCreateFragmentMutation({
      update(cache, { data: updateCreateFragmentData, errors }) {
        const newFragment = updateCreateFragmentData?.insert_Fragment_one

        if (errors) {
          emitToast({
            title: 'Could not create new format',
            type: 'error',
            autoClose: 3000,
          })
        }

        if (!newFragment) return
        emitToast({
          title: 'New format created',
          type: 'success',
          autoClose: 3000,
        })
        history.push(`/story/${id}/${newFragment.id}`)
        cache.updateQuery<GetFragmentListQuery, GetFragmentListQueryVariables>(
          {
            query: GetFragmentListDocument,
            variables: { flickId: id },
          },
          (prevData) => ({
            Fragment: [newFragment, ...(prevData?.Fragment || [])],
          })
        )
      },
    })

  const [duplicateFragment] = useDuplicateFragmentMutation({
    update(cache, { data: duplicateFragmentData, errors }) {
      const newFragment = duplicateFragmentData?.insert_Fragment_one

      if (errors) return
      if (!newFragment) return

      emitToast({
        title: 'Successfully duplicated format',
        type: 'success',
        autoClose: 3000,
      })

      history.push(`/story/${id}/${newFragment.id}`)

      cache.updateQuery<GetFragmentListQuery, GetFragmentListQueryVariables>(
        {
          query: GetFragmentListDocument,
          variables: { flickId: id },
        },
        (prevData) => ({
          Fragment: [newFragment, ...(prevData?.Fragment || [])],
        })
      )
    },
  })

  const [deleteFragment, { loading: deletingFragment }] =
    useDeleteFragmentMutation({
      update(cache, { data: updateDeleteFragmentData, errors }) {
        const deletedFragmentId =
          updateDeleteFragmentData?.delete_Fragment_by_pk?.id

        if (errors) {
          emitToast({
            title: 'Could not delete format',
            type: 'error',
            autoClose: 3000,
          })
        }

        if (!deletedFragmentId) return
        emitToast({
          title: 'Format deleted',
          type: 'success',
          autoClose: 3000,
        })
        const prevData = cache.readQuery<
          GetFragmentListQuery,
          GetFragmentListQueryVariables
        >({
          query: GetFragmentListDocument,
          variables: { flickId: id },
        })
        const filteredData =
          prevData?.Fragment.filter(
            (fragment) => fragment.id !== deletedFragmentId
          ) || []

        if (filteredData.length > 0) {
          history.push(`/story/${id}/${filteredData[0].id}`)
        } else {
          history.push(`/story/${id}`)
        }
        cache.writeQuery<GetFragmentListQuery, GetFragmentListQueryVariables>({
          query: GetFragmentListDocument,
          variables: { flickId: id },
          data: {
            Fragment: filteredData,
          },
        })
        cache.evict({ id: `Fragment:${deletedFragmentId.id}` })
      },
    })

  const handleDuplicate = async (
    type: Fragment_Type_Enum_Enum,
    fragmentId: string
  ) => {
    try {
      const { data, error } = await getFragment({
        variables: {
          id: fragmentId,
        },
      })
      if (error) throw new Error("Can't get fragment")
      if (data?.Fragment_by_pk) {
        let newFragment = {
          ...data.Fragment_by_pk,
        }
        if (
          newFragment.configuration &&
          type === Fragment_Type_Enum_Enum.Presentation
        ) {
          newFragment = {
            ...newFragment,
            configuration: {
              ...newFragment.configuration,
              continuousRecording: false,
            },
          }
        }
        await duplicateFragment({
          variables: {
            configuration: newFragment.configuration,
            description: newFragment.description,
            editorState: newFragment.editorState,
            editorValue: newFragment.editorValue,
            encodedEditorValue: newFragment.encodedEditorValue,
            flickId: id,
            type,
          },
        })
      }
    } catch (e) {
      emitToast({
        title: 'Could not duplicate format',
        type: 'error',
        autoClose: 3000,
      })
    }
  }

  const [open, setOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [moreId, setMoreId] = useState<string>()
  const [duplicateOpen, setDuplicateOpen] = useState(false)

  useEffect(() => {
    if (!moreOpen) {
      setDuplicateOpen(false)
    }
  }, [moreOpen])

  const [availableFormats, setAvailableFormats] =
    useState<Fragment_Type_Enum_Enum[]>()

  useEffect(() => {
    if (!data) return
    const formats = [
      Fragment_Type_Enum_Enum.Landscape,
      Fragment_Type_Enum_Enum.Portrait,
      Fragment_Type_Enum_Enum.Presentation,
      // Fragment_Type_Enum_Enum.Blog,
    ].filter((type) => {
      if (
        type === Fragment_Type_Enum_Enum.Landscape &&
        data?.Fragment?.some(
          (fragment) => fragment.type === type || !fragment.type
        )
      ) {
        return false
      }
      if (
        type === Fragment_Type_Enum_Enum.Blog &&
        data?.Fragment?.some((fragment) => fragment.type === type)
      ) {
        return false
      }
      if (
        type === Fragment_Type_Enum_Enum.Presentation &&
        data?.Fragment?.some((fragment) => fragment.type === type)
      ) {
        return false
      }

      return true
    })
    setAvailableFormats(formats)
  }, [data])

  if (error) return <div>Failed getting fragments</div>

  return (
    <div
      className={cx(
        'flex w-44 flex-col overflow-y-scroll bg-gray-50 py-2',
        verticalCustomScrollBar
      )}
    >
      <Tooltip
        content={
          <AvailableFormats
            availableFormats={availableFormats}
            handleCreate={(type) => {
              setOpen(false)
              createFragment({
                variables: {
                  flickId: id,
                  name: 'Untitled',
                  type,
                },
              })
            }}
          />
        }
        isOpen={open}
        setIsOpen={setOpen}
        placement="bottom-center"
      >
        <Button
          className="pr-14 w-full"
          appearance="none"
          size="small"
          icon={IoAddOutline}
          loading={creatingFragment}
          onClick={() => {
            setOpen(true)
          }}
          type="button"
        >
          <Text className="text-xs text-gray-400">Add new</Text>
        </Button>
      </Tooltip>

      <div className="mt-4 flex flex-col items-start gap-y-3 pl-3 font-main text-xs text-gray-400">
        <p className="flex items-center gap-x-1 overflow-hidden w-full">
          <IoChevronForwardOutline className="mr-px flex-shrink-0" />
          <IoFolderOpenOutline className="flex-shrink-0" />
          <span className="truncate pr-1">{storyName}</span>
        </p>
        <div className="flex flex-col items-start gap-y-3 pl-4 w-full">
          {data?.Fragment.map((fragment) => (
            <Link
              className={cx('flex items-center group w-full justify-between', {
                'text-gray-800': fragment.id === fragmentId,
              })}
              key={fragment.id}
              to={`/story/${id}/${fragment.id}`}
            >
              <div className="flex items-center gap-x-1">
                {(() => {
                  switch (fragment.type) {
                    case Fragment_Type_Enum_Enum.Landscape:
                      return <IoPlayOutline />
                    case Fragment_Type_Enum_Enum.Portrait:
                      return <HiOutlineSparkles />
                    case Fragment_Type_Enum_Enum.Blog:
                      return <IoMenuOutline />
                    case Fragment_Type_Enum_Enum.Presentation:
                      return <MdOutlinePresentToAll />
                    default:
                      return <IoPlayOutline />
                  }
                })()}
                {fragment?.type || 'Landscape'}
              </div>
              <Tooltip
                content={
                  !duplicateOpen ? (
                    <div className="bg-dark-500 text-white text-xs font-body rounded-sm p-1">
                      {deletingFragment && moreId === fragment.id && (
                        <FiLoader className="animate-spin h-8 w-20 p-2.5" />
                      )}
                      <button
                        type="button"
                        className={cx(
                          'flex items-center gap-x-2 py-1 px-2 rounded-sm hover:bg-dark-200 active:bg-dark-300 w-full flex-shrink-0',
                          {
                            hidden: deletingFragment && moreId === fragment.id,
                          }
                        )}
                        onClick={(e) => {
                          e.stopPropagation()
                          setDuplicateOpen(true)
                        }}
                        disabled={deletingFragment}
                      >
                        <IoCopyOutline className="flex-shrink-0" />
                        <Text>Duplicate</Text>
                      </button>
                      <button
                        type="button"
                        className={cx(
                          'flex items-center gap-x-2 py-1 px-2 rounded-sm hover:bg-dark-200 active:bg-dark-300 w-full flex-shrink-0',
                          {
                            hidden: deletingFragment && moreId === fragment.id,
                          }
                        )}
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpen(false)
                          deleteFragment({
                            variables: {
                              id: fragment.id,
                            },
                          })
                        }}
                        disabled={deletingFragment}
                      >
                        <IoTrashOutline className="flex-shrink-0" />
                        <Text>Delete</Text>
                      </button>
                    </div>
                  ) : (
                    <div className="min-w-max">
                      <AvailableFormats
                        availableFormats={availableFormats}
                        handleCreate={(type) => {
                          setMoreOpen(false)
                          handleDuplicate(type, fragment.id)
                        }}
                      />
                    </div>
                  )
                }
                isOpen={moreOpen && fragment.id === moreId}
                setIsOpen={setMoreOpen}
                placement="bottom-end"
              >
                <FiMoreVertical
                  onClick={(e) => {
                    e.preventDefault()
                    setMoreOpen(!moreOpen)
                    setMoreId(fragment.id)
                  }}
                  style={
                    moreOpen && fragment.id === moreId
                      ? {
                          display: 'block',
                        }
                      : undefined
                  }
                  className="hidden group-hover:block"
                />
              </Tooltip>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

const AvailableFormats = ({
  availableFormats,
  handleCreate,
}: {
  availableFormats: Fragment_Type_Enum_Enum[] | undefined
  handleCreate: (type: Fragment_Type_Enum_Enum) => void
}) => {
  if (!availableFormats) return null

  return (
    <div className="bg-dark-400 text-gray-50 text-xs font-body rounded-sm p-1">
      {availableFormats.map((type) => (
        <button
          type="button"
          className={cx(
            'flex rounded-sm items-center gap-x-2 py-1.5 px-3 hover:bg-dark-200 active:bg-dark-300 w-full'
          )}
          onClick={(e) => {
            e.stopPropagation()
            handleCreate(type)
          }}
        >
          {(() => {
            switch (type) {
              case Fragment_Type_Enum_Enum.Landscape:
                return <IoPlayOutline />
              case Fragment_Type_Enum_Enum.Portrait:
                return <HiOutlineSparkles />
              case Fragment_Type_Enum_Enum.Blog:
                return <IoMenuOutline />
              case Fragment_Type_Enum_Enum.Presentation:
                return <MdOutlinePresentToAll />
              default:
                return null
            }
          })()}
          <Text>
            {type}{' '}
            {type === Fragment_Type_Enum_Enum.Blog ||
            type === Fragment_Type_Enum_Enum.Presentation
              ? ''
              : 'video'}
          </Text>
        </button>
      ))}
    </div>
  )
}
export default Sidebar
