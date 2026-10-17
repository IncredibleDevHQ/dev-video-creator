# A voice collaborator on the content map, and voice comments

16 October 2026. The creator's ask: multiplayer between the AI and a human.
You talk to it through OpenAI's Realtime API by voice; it has its own cursor
that moves and does the work; Jev classifies what you ask. Also: comment
with your voice.

## The experience

- **Talk** in the canvas's corner starts a session. "Studio AI" joins the
  map as a collaborator: an avatar beside yours, and a named cursor on the
  canvas, as a second person would in Figma or Flora.
- You speak; it answers aloud. Your words show as a caption at the bottom;
  its words show in a bubble by its cursor.
- When it acts, its cursor glides to the thing it works on and does it, the
  way you would: it drags a direction's handle onto an episode, drops a card
  into a lane, presses Plan, types a note. Every action goes through the
  same calls your own clicks make, so it can be undone the same way.
- Each thing you say is classified by Jev: what you want (plan, a
  direction, a card, an episode, a gap, a comment, a question, chat),
  whether you asked for a change now, and whether it is big enough to
  confirm. The AI only changes the canvas when Jev reads your request as one.
  It asks before a big change (planning again, undoing organising). The
  classification shows under your caption.
- **Comment** (the speech-bubble tool, or C): click a card, an episode, a
  direction or a spot, then hold to speak (or type). The studio keeps your
  recording and writes it down. Jev reads what kind of comment it is (a
  direction for the plan, new material, a question for the AI, or a remark),
  and the comment offers that one step: Make it a direction, Add as a note,
  Ask Studio AI. The AI sees open comments and can act on them.

## How it works

- **Keys stay in the engine.** The browser streams the microphone (PCM16,
  24 kHz) over a WebSocket to the engine. The engine holds the Realtime
  connection (`wss://api.openai.com/v1/realtime?model=gpt-realtime-2.1`,
  bearer key from the environment) and relays audio and events both ways.
  No credential, not even a short-lived one, reaches the browser. Jev runs in
  the engine too.
- **Session:** voice `marin`, semantic VAD that answers and lets you
  interrupt, input transcription (`gpt-4o-mini-transcribe`), PCM16 both
  ways, the canvas tools, and instructions that carry the canvas as text:
  the outcome, lines, episodes and their cards, directions, gaps and open
  comments. The text is refreshed when the map changes.
- **Tools:** look at something; add, wire or remove a direction; add a note;
  copy a card into an episode; put an episode after another; start an
  episode; set the outcome or audience; plan the series; act on a gap; undo
  the last organising run; comment, reply or resolve. The browser runs each
  one with the AI's cursor and returns what happened, with the canvas as it
  is now.
- **Jev gate:** on each finished transcript (or typed line) the engine asks
  Jev three questions in one call: `intent` (choice of plan, direction,
  material, episode, brief, gap, comment, question, chat), `act` (did the
  creator ask for a change now) and `yes` (did they say yes to a change
  Studio AI proposed). A tool waits for that reading. A tool that changes
  the canvas runs only when the latest words read as a change (`act` at
  least 0.5) of a kind the tool belongs to (the top intent, or one at 15% or
  more, so a mixed request carries both). A big tool (planning again,
  undoing organising) needs the AI to have asked (`confirmed: true`) and the
  creator's yes (`yes` at least 0.5). Looking is always allowed. A held tool
  goes back to the AI with the reason, so it asks instead; the caption shows
  the reading and the hold. Without Jev, tools run and the reading shows as
  missing.
- **The cursor:** Studio AI's cursor sits over the canvas in screen pixels
  and follows pans and zooms. It glides to its target (bringing it into
  view), rings it in its own colour, opens the Add menu where a person
  would, drags a wire from a handle, and types a note into a bubble; its
  spoken words show in a bubble by it. Short ids (c3, e2, d1, g1, k1) name
  things in the canvas text and stay for the whole call.
- **Comments:** recorded with MediaRecorder (up to 60 s), sent to the
  engine, stored as an asset, written down with OpenAI's transcription API,
  and classified by Jev. They are kept in their own row per map, shown as
  pins, and listed in the AI's canvas text.

## Not in this pass

Several humans at once, the AI's own voice in exported videos, wake words,
and voice on screens other than the content map.
