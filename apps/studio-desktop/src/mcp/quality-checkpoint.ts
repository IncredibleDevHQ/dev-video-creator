export type QualityReview = {
  hash: string; score: number; limitations: string[]
  checks: Array<{ category: 'render' | 'design' | 'causal' | 'viewing'; event: string; atMs: number; expected: string; observed: string; passed: boolean }>
  exportHash: string; listened: boolean
}
export function validateQualityReview(review: QualityReview, hash: string, durationMs: number, exportHash: string): string[] {
  const errors: string[] = []
  if (review.hash !== hash || !exportHash || review.exportHash !== exportHash) errors.push('Review must bind the current candidate and its actual short export')
  if (!Number.isFinite(review.score) || review.score < 0 || review.score > 100) errors.push('Score must be between 0 and 100')
  if (!Array.isArray(review.limitations)) errors.push('Record known limitations, including an empty list when none remain')
  for (const category of ['render', 'design', 'causal', 'viewing']) {
    const checks = (review.checks || []).filter(check => check.category === category)
    if (!checks.length) errors.push(`Missing ${category} review`)
    for (const check of checks) {
      if (!check.event || !(check.atMs >= 0 && check.atMs <= durationMs) || typeof check.expected !== 'string' || check.expected.trim().length < 15 || typeof check.observed !== 'string' || check.observed.trim().length < 15) errors.push(`${category}: identify event, timestamp, expected and observed result`)
      if (!check.passed) errors.push(`${category}: ${check.event} still fails`)
    }
  }
  if (!review.listened) errors.push('Viewing/listening review is incomplete')
  return errors
}
