import { Analytics } from '@segment/analytics-next'
import { PageCategory, PageEvent, PageTitle } from './analytics-types'

declare global {
  interface Window {
    analytics: Analytics
  }
}

export const logPage = (category: PageCategory, page: PageTitle) => {
  window.analytics.page(category, page)
  console.log('Segment : logPage => ', category, page)
}

export const logEvent = (eventName: PageEvent) => {
  window.analytics.track(eventName)
  console.log('Segment : logEvent => ', eventName)
}
