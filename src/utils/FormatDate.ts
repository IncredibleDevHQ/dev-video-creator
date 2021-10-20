import { format, intervalToDuration } from 'date-fns'

export const formatDate = (date: Date, pattern?: string) => {
  return format(date, pattern || 'MMM dd, yyyy hh:mm b')
}

export const getDurationBetweenDates = (newDate: Date, baseDate: Date) =>
  intervalToDuration({ start: newDate, end: baseDate })
