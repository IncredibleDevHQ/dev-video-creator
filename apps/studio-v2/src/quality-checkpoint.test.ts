import { expect, it } from 'vitest'
import { validateQualityReview, type QualityReview } from '../../studio-desktop/src/mcp/quality-checkpoint'
it('keeps valid rendering separate from causal, visual and listening acceptance', () => {
  const review: QualityReview = {hash:'current',exportHash:'mp4',score:85,limitations:[],listened:true,checks:['render','design','causal','viewing'].map(category=>({category:category as QualityReview['checks'][number]['category'],event:'consume-one',atMs:1000,expected:'One token disappears when the request is accepted',observed:'At 1000ms the visible count changes from 1 to 0',passed:true}))}
  expect(validateQualityReview(review,'current',4000,'mp4')).toEqual([])
  expect(validateQualityReview({...review,checks:review.checks.slice(0,1)},'current',4000,'mp4')).toContain('Missing causal review')
  expect(validateQualityReview({...review,listened:false},'current',4000,'mp4')).toContain('Viewing/listening review is incomplete')
  expect(validateQualityReview(review,'new-manifest',4000,'mp4')).not.toEqual([])
  expect(validateQualityReview({...review,checks:[{...review.checks[0],observed:'looks good'}]},'current',4000,'mp4')).not.toEqual([])
})
