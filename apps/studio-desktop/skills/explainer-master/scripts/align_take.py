"""Align a recorded take once, then map the program's beats onto its actual
transcript in order (D5). The take's real delivery — emphasis, pauses, pace
and wording — becomes the timing authority. A beat whose words are missing or
changed is flagged for review, never silently invented.

Invoked by the product, never by a model API:
  uv run --with faster-whisper==1.2.0 python align_take.py manifest.json

manifest: { "audio": "/abs/take-or-scene-audio",
            "beats": [{ "id": "b1", "say": "…" }],
            optional "transcript": [{ "word", "startMs", "endMs" }] }
The canned transcript path skips the model (contract tests). Output lands in
manifest.with_suffix('.take-aligned.json').
"""
import difflib
import json
import re
import sys
from pathlib import Path

manifest = Path(sys.argv[1])
data = json.loads(manifest.read_text())
normalize = lambda word: re.sub(r"[^\w]", "", word.lower())

if "transcript" in data:
    heard = [{"word": w["word"], "startMs": round(w["startMs"]), "endMs": round(w["endMs"])} for w in data["transcript"]]
else:
    from faster_whisper import WhisperModel
    model = WhisperModel(data.get("model", "base.en"), device="cpu", compute_type="int8")
    segments, _ = model.transcribe(data["audio"], language="en", word_timestamps=True,
                                   condition_on_previous_text=False)
    heard = [{"word": w.word, "startMs": round(w.start * 1000), "endMs": round(w.end * 1000)}
             for segment in segments for w in (segment.words or [])]

heard_norm = [normalize(w["word"]) for w in heard]
cursor = 0
out_beats = []
for beat in data["beats"]:
    expected = beat["say"].split()
    expected_norm = [normalize(w) for w in expected]
    # This beat's words are sought from where the previous beat ended: the
    # take moves forward, and repeated words keep their occurrence identity.
    window = heard_norm[cursor:]
    matcher = difflib.SequenceMatcher(None, expected_norm, window, autojunk=False)
    words = []
    last_heard_index = cursor
    for block in matcher.get_matching_blocks():
        for index in range(block.size):
            found = heard[cursor + block.b + index]
            words.append({"word": expected[block.a + index], "startMs": found["startMs"], "endMs": found["endMs"]})
            last_heard_index = cursor + block.b + index
    matched = len(words)
    coverage = matched / max(1, len(expected))
    if matched and coverage >= 0.5:
        start = words[0]["startMs"]
        end = words[-1]["endMs"]
        cursor = last_heard_index + 1
    else:
        # A near-miss is not "said here": keep the heard words as evidence but
        # do not consume the take — the next beat may still be said.
        start = heard[cursor]["startMs"] if cursor < len(heard) else (heard[-1]["endMs"] if heard else 0)
        end = start
    review = None
    if coverage < 0.85:
        missing = [w for w, n in zip(expected, expected_norm) if not any(normalize(x["word"]) == n for x in words)]
        review = f"The take does not say this here: \"{' '.join(missing[:8])}\" — rebind the cue or record a pickup."
    out_beats.append({"id": beat.get("id"), "say": beat["say"], "words": words,
                      "coverage": round(coverage, 3), "startMs": start,
                      "durationMs": max(0, end - start), "review": review})

data["beats"] = out_beats
manifest.with_suffix(".take-aligned.json").write_text(json.dumps(data, indent=2))
print(json.dumps({"beats": len(out_beats), "coverage": [b["coverage"] for b in out_beats],
                  "review": [b["id"] for b in out_beats if b["review"]]}))
