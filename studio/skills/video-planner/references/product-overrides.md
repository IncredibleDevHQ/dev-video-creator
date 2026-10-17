# Product overrides of the pinned workflow

The pinned `general-video` workflow, its router and its domain skills are
written for a standalone Hyperframes project driven from a chat. This product
runs them inside its own authoring records, with its own preferences,
providers and review. Where the two disagree, this file wins. Everything not
listed here is read as upstream wrote it.

| Upstream behaviour | In this product |
| --- | --- |
| Run `npx hyperframes skills update …` before relying on a skill | The bundle is pinned to one commit and frozen for the run. Never update or reinstall; read the files as they are. |
| Run the intent interview; write `BRIEF.md` with `hyperframes init` | The product writes `packet/BRIEF.md` from the approved Explanation Brief. It is the no-repeat token: ask no brief questions and do not scaffold a project. |
| `BRIEF.md` `workflow:` names another workflow → hand off | The brief's route is the one owning workflow for the whole video. Borrow guidance from other skills inside it; never start a second workflow. |
| Search the hosted registry with `npx hyperframes catalog` before naming a look | No network or CLI in a planning run. Name recipes from the pinned indexes; a look they do not cover is an `adapted` recipe, described so construction can build or source it. |
| Record preferences with `media-use`; run `hyperframes auth status` | The product holds preferences and provider credentials. Record none; call no provider. |
| After Plan: resolve dependencies, build scenes, dispatch packets, assemble, verify, render | Stop after Plan. The product's review is the plan review; construction is a later, separate run. |
| `storyboard: yes` review loop with `storyboard.html` sketches | The product's planning workspace is the review surface. Write no sketches; the plan's moments and channels are what the creator reviews. |
| Frame blocks in `STORYBOARD.md` as the dispatch artifact | Not written in a planning run. The treatment records the moments, recipes and their purposes instead. |
| Narration drafted freely to fit the pacing | Narration in a plan is guidance. When the brief carries approved lines, those words are spoken verbatim and the plan works around them. |
| A workflow may assume a faceless or an on-camera format | Delivery is chosen per scene by the creator. An undecided scene stays undecided; a presenter suggestion is a note, not a decision. A generated-only scene reserves no presenter space. |
| Genre defaults: pitch pacing, card-count floors, layout churn, a pattern change every few seconds | Explainer defaults: calm spatial continuity, readable holds, change only when it explains something. |

The upstream research these overrides respond to is summarised in the
product's contract audit (`docs/plans/hyperframes-explanation-brief-contract.md`
in the repository).
