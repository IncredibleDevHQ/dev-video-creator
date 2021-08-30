import React, { forwardRef, HTMLProps, useEffect } from 'react'
import { useTable, Column, Row, useRowSelect, HeaderProps } from 'react-table'

interface Props {
  indeterminate?: boolean
  name: string
}

const useCombinedRefs = (...refs: any[]): React.MutableRefObject<any> => {
  const targetRef = React.useRef()

  React.useEffect(() => {
    refs.forEach((ref) => {
      if (!ref) return

      if (typeof ref === 'function') {
        ref(targetRef.current)
      } else {
        // eslint-disable-next-line no-param-reassign
        ref.current = targetRef.current
      }
    })
  }, [refs])

  return targetRef
}

const IndeterminateCheckbox = forwardRef<HTMLInputElement, Props>(
  ({ indeterminate, ...rest }, ref: React.Ref<HTMLInputElement>) => {
    const defaultRef = React.useRef(null)
    const combinedRef = useCombinedRefs(ref, defaultRef)

    useEffect(() => {
      if (combinedRef?.current) {
        combinedRef.current.indeterminate = indeterminate ?? false
      }
    }, [combinedRef, indeterminate])

    return (
      <>
        <input type="checkbox" ref={combinedRef} {...rest} />
      </>
    )
  }
)

const TableView = () => {
  const data = React.useMemo(
    () => [
      {
        col1: 'Hello',
        col2: 'World',
      },
      {
        col1: 'react-table',
        col2: 'rocks',
      },
      {
        col1: 'whatever',
        col2: <img src="https://placekitten.com/100/100" alt="kitten" />,
      },
    ],
    []
  )

  const columns = React.useMemo<Column<{ col1: string; col2: any }>[]>(
    () => [
      {
        Header: () => <div className="text-left">col1</div>,
        accessor: 'col1',
        maxWidth: 40,
      },
      {
        Header: 'Column 2',
        accessor: 'col2',
      },
    ],
    []
  )

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow,
    state,
  } = useTable({ columns, data }, useRowSelect, (hooks) => {
    hooks.visibleColumns.push((columns) => [
      {
        id: 'selection',
        Header: ({ getToggleAllRowsSelectedProps }: any) => (
          <div className="text-left w-4">
            <IndeterminateCheckbox {...getToggleAllRowsSelectedProps()} />
          </div>
        ),
        Cell: ({ row }: { row: any }) => (
          <div className="text-left w-4">
            <IndeterminateCheckbox {...row.getToggleRowSelectedProps()} />
          </div>
        ),
      },
      ...columns,
    ])
  })

  return (
    <div>
      <table className="w-full border-collapse space-y-4" {...getTableProps()}>
        <thead>
          {headerGroups.map((headerGroup) => (
            <tr
              className="bg-gray-100 rounded-md py-3"
              {...headerGroup.getHeaderGroupProps()}
            >
              {headerGroup.headers.map((column) => (
                // Apply the header cell props
                <th {...column.getHeaderProps()}>
                  {
                    // Render the header
                    column.render('Header')
                  }
                </th>
              ))}
            </tr>
          ))}
        </thead>
        {/* Apply the table body props */}
        <tbody {...getTableBodyProps()}>
          {
            // Loop over the table rows
            rows.map((row) => {
              // Prepare the row for display
              prepareRow(row)
              return (
                // Apply the row props
                <tr {...row.getRowProps()}>
                  {
                    // Loop over the rows cells
                    row.cells.map((cell) => {
                      // Apply the cell props
                      return (
                        <td {...cell.getCellProps()}>
                          {
                            // Render the cell contents
                            cell.render('Cell')
                          }
                        </td>
                      )
                    })
                  }
                </tr>
              )
            })
          }
        </tbody>
      </table>
    </div>
  )
}

export default TableView
