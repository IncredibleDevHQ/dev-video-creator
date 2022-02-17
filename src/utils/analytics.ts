import { Analytics } from '@segment/analytics-next'
import config from '../config'
import { PageCategory, PageEvent, PageTitle } from './analytics-types'

declare global {
  interface Window {
    analytics: Analytics
  }
}

export const logPage = (category: PageCategory, page: PageTitle) => {
  if (config.node_env === 'production') {
    window.analytics.page(category, page)
  } else {
    console.log('Segment : logPage => ', category, page)
  }
}

export const logEvent = (eventName: PageEvent) => {
  if (config.node_env === 'production') {
    window.analytics.track(eventName)
  } else {
    console.log('Segment : logEvent => ', eventName)
  }
}
