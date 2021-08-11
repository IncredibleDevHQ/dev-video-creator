import { format, intervalToDuration } from 'date-fns'

export const formatDate = (date: Date) => {
  return format(date, 'MMM dd, yyyy hh:mm b')
}

export const getDurationBetweenDates = (newDate: Date, baseDate: Date) =>
  intervalToDuration({ start: newDate, end: baseDate })
