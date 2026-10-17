# Series that build: course-style episode planning on a connected canvas

16 October 2026. The creator's ask: read everything, find the through-lines,
sequence the episodes so each builds on the last, and flag the gaps the
material doesn't cover (the course-outline method, applied to episodes). One
series is made from the root cards; as new cards pile in, they organise
themselves into episodes. The creator's own ideas about episodes are an input
to the plan. The canvas is a connected flow modelled on Flora's: cards into
episodes, one episode leading to the next, socials out of episodes.

## What was wrong

- Plan Series saw page titles and ideas only, applied at once, and kept no
  memory of its last plan: the arc, threads and every episode's part could
  drift on each re-plan.
- Nothing modelled what an episode needs from an earlier one. "Earlier
  episodes set up what later ones need" was a sentence in a prompt.
- No gaps at series level; the pages a plan left out were never shown.
- "Keep planning" re-ran the whole 14-minute plan for one new page, and new
  pages could only go at the end of an episode or after the last one.
- The creator's direction was one line of "ideas".
- The canvas showed none of the plan: no through-line, threads or outcome.

## The method (from course outlining)

1. **Outcome first.** "By the end, viewers can ___" anchors the plan; a vague
   outcome makes a topic list, not a series. The audience sets scope and pace.
   When the creator gives neither, the planner proposes both, marked as
   suggested until the creator edits them.
2. **Read all the material together**: every card's idea and evidence, not
   only its title.
3. **Through-lines**: two to four named lines that run across episodes.
4. **Order for learning, not for publication**: each episode needs only what
   earlier ones taught (conceptual dependency), the first gives an early win,
   and the arc has a lift in the middle and a satisfying finish.
5. **Flag gaps**: what the sequence needs but no card covers, where it is
   needed, and the question that would fill it.
6. **Check as the viewer**: confusing, slow, overloaded, or assuming.
7. **The creator's directions are followed or answered**: each says whether
   the plan followed it, and why not when it didn't.

## The model

Series gains:

- `outcome`, `audience`, and `suggested` (which of them the planner proposed).
- `directions`: the creator's guidance as notes on the canvas. Each has its
  words and what it is wired to (nothing = the whole series, an episode, or
  some cards), where it sits, and the last plan's answer: followed, partly or
  not, with a line of why.
- `lines`: the through-lines (id, name, one sentence).
- `gaps`: id, what is missing, the episode that needs it, why, the question
  that would fill it, and its state (open, explained in an episode, ignored,
  closed by a card).
- `flags`: the viewer check's notes, per episode.
- `organize` (was `autoplan`): new cards organise themselves into episodes.
- `organized`: the last organising runs, each with what moved, for Undo.
- Each `episodes[i].outline`: the episode's win (what the viewer can do
  after), what it teaches, what it needs (each from an earlier episode or an
  open gap), and its through-lines.

An episode is **made** once its video has started (a scene is being made, or
the video is joined). A made episode keeps its pages and its place; open
episodes can be reorganised freely.

## Plan Series (whole outline)

Packet: the series brief (title, outcome, audience, directions with what they
are wired to, length, the episodes that exist with made or open), every drawn
card (id, title, idea, up to three lines of evidence, the opening of its
script, topic, seconds), the last outline (lines, each episode's outline) so a
re-plan keeps what still holds, and the source.

Output: outcome and audience (when the creator gave none), lines, episodes in
order (title, about, win, teaches, needs, carries, lines, pages, and for an
existing episode its notebook), gaps, overlaps, left, an answer per
direction, and viewer flags.

Checks: every made episode at its place with its pages; every drawn card in
one episode or in `left`; each need from an earlier episode or a declared gap;
directions all answered; lengths as before.

Apply: open episodes get exactly their planned pages (copies added, moved,
removed); new episodes are made and put in place; the series order is set in
one step; segues are rewritten only where neighbours changed.

## Place Pages (self-organising)

When drawn cards appear that no episode uses (and not left or set aside), and
organising is on, a fast route places only the new cards. Each new card goes
into an open episode at a place, starts a new episode at a place after the
last made one, closes an open gap, or is left out with a reason. Made episodes
never change. The run is recorded; Undo takes out what it added. The map's
activity says what moved, and the canvas shows it with Undo.

## The canvas (modelled on Flora)

- A left-to-right flow: the Cards frame, the Series frame with one lane per
  episode, the Socials frame. Frames are quiet groups with a chip label.
- Nodes carry their label above them (name left, a dim meta right); the
  drawing fills the card.
- Thin curved wires, faint at rest and strong for the selection: each card
  into the episodes that use it, each episode into the next (its hand-off on
  the wire), each made episode into its socials, each direction into what it
  guides. Inputs are on the left, outputs on the right.
- Connect by dragging from a node's right handle: a card onto an episode
  copies it in; an episode onto another puts that one next; an episode onto
  the Socials frame makes a teaser or posts; a direction onto the series, an
  episode or cards scopes it. Dropped on empty canvas, the handle offers the
  nodes it can make there.
- Double-click the canvas (or press +) for the Add menu: Direction, Note,
  Episode, with letter shortcuts.
- Floating chrome: the map's name top-left, a tool pill on the left, the
  Queue (agent work under way) bottom-right, zoom bottom-left.
- The series head shows the outcome, audience, through-lines and gaps; each
  lane shows its win and through-lines; a gap is a dashed card where it is
  needed, with Add a note, Explain it here and Ignore.

## Into each episode's video

The storyboard brief gets the series outcome and audience, the through-lines,
and the episode's win, teaches and needs. "Previously" is worked out from the
episode before it in the current order, not frozen at creation.

## Tuned after the live tests (16 October)

Six live runs on throwaway stores showed the plans sound and five places
where the series lost track of itself:

- **Gaps had no memory.** A re-plan re-derived them, so an open gap could
  vanish without a word, and one the creator explained or ignored could come
  back reworded. The planner now reads the last plan's gaps with what the
  creator did with each, keeps their ids, never raises an ignored one, and
  names in `resolved` why an open one is no longer needed. That gap closes
  with its reason, and the map's activity says so.
- **A note that answered a gap was folded into a card.** Sort Note preferred
  adding to a page and could not see the gaps. It now reads them; a note
  that answers one becomes its own card marked `fills`, and organising
  closes that gap where it is needed.
- **Organising left directions' answers stale.** Place Pages now sees each
  direction's last answer and answers again the ones its moves change; Undo
  puts the old answers back.
- **Turning organising on did nothing for waiting cards.** It now places
  them at once.
- **Open episodes kept stale copies.** The plan reads the map's cards as they
  are; an open episode now holds them as they are too. A copy the creator
  edited in the episode, or chose to keep, stays as it was.
- **Reshaped episodes kept their old names.** The plan's title reached only
  the episode's part; the map showed the name the episode was born with, and
  the next plan reused it. An open episode now takes the plan's name unless
  the creator named it by hand, and the planner is told which names are the
  creator's and that its own follow the cards. A made episode keeps its name.
- **An episode that organising started had no hand-off line.** It now
  carries its part, through-lines and length, like a planned one.

## Not in this pass

Semantic zoom, multiplayer cursors, a canvas chat with the planner, moving a
made episode, and a node toolbar over each card (the selection bar stays).
