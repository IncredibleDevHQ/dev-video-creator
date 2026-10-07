// Templates before narratives (October 2026): each old template, under the
// narrative it told. A video saved with one opens on that narrative, in its
// default direction.
const OLD_TEMPLATES = `
how-it-works: how-it-works how-it-works-fast how-it-works-board how-it-works-desk how-it-works-read
architecture: architecture-map architecture-guided
paper: paper-figure paper-plain paper-reel
ai-feature: ai-pipeline ai-evals
myths: myths-cards myths-host
observability: obs-trace obs-oncall
slo: slo-budget slo-choice
data-pipeline: pipeline-event pipeline-counters
platform: platform-golden-path platform-deploy
testing: testing-shape testing-fast
essay: essay-argument essay-take
quickstart: quickstart-clock quickstart-code
tutorial: feature-deep-dive tutorial-follow
integration: integration-steps integration-recipes
troubleshooting: fix-first fix-walkthrough
tip: tip-short tip-card
onboarding: onboarding-tour onboarding-silent
api: api-three-calls api-terminal
recipes: recipes-countdown recipes-screen
faq: faq-asked faq-card
switching: switching-map switching-why
design-decision: design-decision decision-pitch decision-options decision-verdict
comparison: comparison-faceoff comparison-tree
experiment: experiment-readout experiment-bottom
incident: incident engineering-story incident-anchor incident-thriller
debugging: debug-whodunit debug-screencast debug-short
performance: perf-before-after perf-lab perf-race
migration: migration-heist migration-phases migration-numbers
security: security-advisory security-replay
retro: retro-lessons retro-then-now retro-columns
scaling: scaling-walls scaling-number
cost: cost-steps cost-number
rewrite: rewrite-race rewrite-honest
gameday: gameday-report gameday-live
tech-debt: debt-burndown debt-interest
readiness: readiness-countdown readiness-report
launch: launch-demo launch-keynote launch-teaser launch-founder
release: release-roundup release-changelog release-monthly
devlog: devlog-weeks devlog-adventure
code-change: pr-files pr-short
overview: overview-fast overview-guided
deprecation: deprecation-notice deprecation-guide
maintenance: maintenance-notice status-update
product-update: update-roadmap update-letter
project-update: project-status project-bottom-line
pricing: pricing-plain pricing-compare
year-review: year-wrapped year-letter
preview: preview-flashes preview-walk
event: event-speaker event-cards
license: license-plain license-tree
trust: trust-badge trust-audit
customer: customer-results customer-interview
team: team-meet team-day team-principles
oss: oss-readme oss-why oss-launch
talk: talk-slides talk-stage talk-conference
demo-day: demo-show demo-reel
interview: interview-qa interview-profile
data-report: report-league report-quarter
listicle: list-numbered list-told
community: community-makers community-host
event-recap: recap-themes recap-host
`

const LEGACY = new Map(
  OLD_TEMPLATES.trim()
    .split('\n')
    .flatMap((row) => {
      const [narrative, templates] = row.split(':')
      return templates
        .trim()
        .split(/\s+/)
        .map((template) => [template, narrative.trim()] as const)
    })
)

/** The narrative an old template told, when there is one. */
export const legacyNarrative = (template?: string | null) =>
  template ? LEGACY.get(template) : undefined
