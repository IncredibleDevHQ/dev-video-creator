import { format } from 'date-fns'

export const formatDate = (date: Date) => {
  return format(date, 'MMM dd, yyyy hh:mm b')
}
