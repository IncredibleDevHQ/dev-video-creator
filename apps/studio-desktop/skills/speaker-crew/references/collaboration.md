# Collaboration

> Reference for the `speaker-crew` skill. Source: *The Motion Decision Core*, sections §26. Read only when the routing table triggers it.

The ownership grammar and ten collaboration patterns.

## 26. Collaboration patterns: two people explaining together

Part III gives the stage for several speakers; this section gives the **scenes**: what happens on screen when two people explain and build something together. Every pattern is a composition of Part I operations on the page, Part II slots over the camera and Part III tiles, so nothing here adds a mechanism. What it adds is a small grammar of **ownership on screen**.

### 26.1 The ownership grammar

| Rule | What it means on screen |
|---|---|
| **Attribution mark** | An element that one speaker contributed carries a **tab** (`attr.tab` 0.02 W × the element's height, on the host's side for the host and the guest's side for the guest) or a **dot** (`attr.dot` 0.012 H) in that speaker's colour. Never a colour fill, never a different typeface: the mark is at the edge, the content stays neutral. |
| **Shared is neutral** | Elements that belong to the conversation (the page, a conclusion, a shared figure) are drawn in the theme's neutral stroke with no mark. |
| **Ownership decays** | A mark fades to neutral `attr.decayAfter` 2000 ms after the other speaker **accepts** (an acknowledgement word: "right", "yes", "exactly", a nod cue) or at the beat with intent `recap`. A list keeps its dots until recap: the list is the record of who said what. |
| **One hero per beat, even with two voices** | The beat's hero is the element being explained; the **ring** says who is explaining it. A second voice may add at most **one** attributed item to that beat (a callout, a question chip, a correction). |
| **Cue ownership** | An element enters on the cue word of the speaker who states it. A shared element stated by both lands on the first. An answer lands on the answerer's word, never on the question. |
| **Names before claims** | An attributed mark may appear only after that speaker's identity strap has been shown in the scene (Part III §22.1). |
| **Budgets** | ≤ 2 attributed items visible; ≤ 1 new attributed item per 3 s; a question chip counts as one; the page's own reveals are not attributed items. |
| **Colour** | Speaker colours from the theme, outside the skin band, distinguishable for colour-blind viewers; the **side** of the tab (host left, guest right) is the second channel, so colour is never the only difference. |

### 26.2 The patterns

Families are Part III's; "Ana" is the host, "Ben" the guest.

| # | Pattern | Family | Who does what | What animates | Cue, attribution, clearing |
|---|---|---|---|---|---|
| 1 | **Pass the baton** (a pipeline, stage by stage) | `content-multi` | Ana explains stages 1–2, Ben stages 3–4 | each stage `reveal`s and its connector `trace`s on the explainer's cue; the ring follows the explainer; each stage carries the explainer's tab | the handoff is a turn switch with no size change (chips); at `recap` all tabs fade to neutral |
| 2 | **Build a list together** | `split-duo` (list as content) | alternating contributions | bullets rise on each speaker's cue with their dot; a tally in the header counts ("2 of 3") | ≤ 1 new bullet per 3 s; dots stay until recap; the tally is shared (neutral) |
| 3 | **Point and annotate** | `content-multi` | Ana explains (trace), Ben annotates | Ana's trace on her cues; Ben's `pinnedCallout` anchored to a page unit, his tab, on his cue | the callout clears `gap.overlayClear` 300 ms before Ana's next cue; the page stays the hero |
| 4 | **Question and reveal** | `content-multi` or `dual-box` + shared column | Ben asks, Ana answers | a **question chip** ("?" + ≤ 6 words, Ben's colour) on his cue; nothing else changes; the answer value `count`s on Ana's cue with her tab; the chip turns "✓" and exits `question.hold` 1000 ms after the landing | gate-before-word: the value never previews; the value is attributed to the answerer |
| 5 | **Agree, disagree, converge** | `split-duo` | each states a position | two **position cards** in tile colours (paired: same size, same row); on "we agree" / "both" they FLIP-merge into one neutral **conclusion card** centred in the content | converge on the cue of whoever says it, `converge.dur` 600; rings on both during the merge, off after (the conclusion is shared) |
| 6 | **Correction** | any with a shared figure | Ana states, Ben corrects | `swap` with `style: strike`: the old value struck through in Ana's colour, the new value in Ben's colour; when Ana accepts, both decay to neutral | never a plain replace: the viewer must see what changed and who changed it |
| 7 | **Two at one board** | `dual-wide` (one camera) | both point at cards in the free region | cards in the centre gap are shared (neutral); pointing by either person flashes their tab on the card edge for 300 ms and `emphasize`s it; both pointing → both tabs, card at full | pointing drives emphasis as in Part II §11.3; no reframes while both point |
| 8 | **Node by node** | `content-multi` | interleaved contributions | each node `reveal`s with its speaker's tab; a connector is traced by whoever states the relation; at recap the tabs fade and the diagram is neutral | builds one shared artefact from two voices; the ring may change every beat, the chips never resize |
| 9 | **Look at the same thing** | `content-multi`, chips one class smaller | both go quiet on the material | the page `camera` pushes into a region; **both rings off** (the content is the hero); chips shrink one size class over 450 ms; return on the next turn | the only moment no speaker is emphasised; the camera cue may come from either |
| 10 | **Guest presents** | `dominant` (Ben) → `content-multi` | Ben holds the floor with his slide | dominance earned after 12 s; when his slide arrives the family becomes `content-multi` with the ring on Ben; Ana's interjections flicker her ring; her question becomes pattern 4; handing back returns to `dual-box` | the host keeps Next unless the author hands it over for the segment |

### 26.3 Worked examples

**(a) Pass the baton.** Four-stage pipeline; steps 1–2 attributed to Ana, 3–4 to Ben.

```json
{ "stage": { "base": { "family": "content-multi", "tiles": [ { "speaker": "ana" }, { "speaker": "ben" } ] } },
  "steps": [
    { "id": "s1", "narration": { "speaker": "ana", "sentences": [1] }, "intent": "introduce", "hero": ["u-ingest"], "actions": [ { "op": "reveal", "targets": ["u-ingest"] } ] },
    { "id": "s2", "narration": { "speaker": "ana", "sentences": [2] }, "intent": "relate", "hero": ["u-parse"], "actions": [ { "op": "trace", "targets": ["u-arrow-1"] }, { "op": "reveal", "targets": ["u-parse"] } ] },
    { "id": "s3", "narration": { "speaker": "ben", "sentences": [3] }, "intent": "relate", "hero": ["u-cache"], "actions": [ { "op": "trace", "targets": ["u-arrow-2"] }, { "op": "reveal", "targets": ["u-cache"] } ] },
    { "id": "s4", "narration": { "speaker": "ben", "sentences": [4] }, "intent": "relate", "hero": ["u-serve"], "actions": [ { "op": "trace", "targets": ["u-arrow-3"] }, { "op": "reveal", "targets": ["u-serve"] } ] },
    { "id": "s5", "narration": { "speaker": "ana", "sentences": [5] }, "intent": "recap", "hero": ["g-pipeline"] } ] }
```
Resolved: the attribution mark is derived from `narration.speaker` per step (the author writes nothing); the ring follows the same field; the turn switch at s3 is a `turn` event with no size change; s5 fades every tab to neutral over `attr.decayAfter`.

**(b) Question and reveal.**

```json
{ "steps": [
    { "id": "q1", "narration": { "speaker": "ben", "sentences": [6] }, "intent": "question", "hero": ["u-latency"],
      "actions": [ { "op": "reveal", "targets": ["q-chip"], "value": { "text": "how much did it drop?" } } ] },
    { "id": "a1", "narration": { "speaker": "ana", "sentences": [7], "cueWordIndex": 5 }, "intent": "quantify", "hero": ["u-latency"],
      "actions": [ { "op": "count", "targets": ["u-latency-num"], "value": { "to": "46 ms" } }, { "op": "exit", "targets": ["q-chip"] } ] } ] }
```
Resolved: `q-chip` is a `cornerCard`-class slot member attributed to Ben (his colour, his side); the count lands on "forty-six" from Ana's onsets; the chip swaps to "✓" at the landing and exits 1000 ms later; the validator refuses a plan in which `a1` precedes `q1` or in which the value is visible before Ana's cue.

**(c) Converge.**

```json
{ "steps": [
    { "id": "p1", "narration": { "speaker": "ana", "sentences": [8] }, "intent": "contrast", "hero": ["pos-ana"], "actions": [ { "op": "reveal", "targets": ["pos-ana"] } ] },
    { "id": "p2", "narration": { "speaker": "ben", "sentences": [9] }, "intent": "contrast", "hero": ["pos-ben"], "actions": [ { "op": "reveal", "targets": ["pos-ben"] } ] },
    { "id": "c1", "narration": { "speaker": "ana", "sentences": [10] }, "intent": "converge", "hero": ["conclusion"],
      "actions": [ { "op": "morph", "targets": ["pos-ana", "pos-ben"], "value": { "toUnit": "conclusion" } } ] } ] }
```
Resolved: `converge` is a template, not a new op: two `move`s toward the conclusion rect, a crossfade to the neutral card (tier 3 morph), 600 ms, rings on both then off.

### 26.4 Tokens

| Token | Value | Source |
|---|---|---|
| `attr.tab / attr.dot` | 0.02 W × element height / 0.012 H | ours |
| `attr.decayAfter` | 2000 ms after acceptance or at recap | ours |
| `question.hold` | landing + 1000 ms | ours |
| `converge.dur` | 600 ms, `ease.travel`, rings on both | ours |
| `list.rate / tally.h` | ≤ 1 bullet per 3 s / 0.03 H | Part II budgets |
| `board.flash` | 300 ms tab flash on a pointed card | Part II gesture |
| `chips.small` | one size class smaller (0.14 → 0.12 W) while the content is the hero | Part III chips |

### 26.5 Planner, validator, ownership

- **Planner.** Each sentence gets a **dialogue act** as well as a speaker: statement, question, answer, agree ("right", "exactly", "we agree"), correct ("actually", "no, it was"), handoff ("over to you", "your turn", "as Ben said"). Acts select patterns: question → answer pairs become pattern 4; agree after two contrasting statements becomes 5; correct becomes 6; handoff marks the baton. The planner may propose the pattern; it never sets marks, colours or timing.
- **Validator.** Errors: an attributed item for a speaker not yet named; an answer value visible before the question's speaker's cue; a `converge` without two positions; a colour **fill** on a shared unit. Warnings: > 2 attributed items visible; > 1 attributed item per speaker per beat; a list faster than `list.rate`; a correction shown as a plain replace.
- **Ownership.** Author: the pattern per scene (or none), who is host, whether ownership decays. Rule: marks, sides, decay, budgets, rings. LLM: speaker and dialogue act per sentence, pattern proposal.

---


---

