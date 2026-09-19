"""Align guide narration locally. Invoked by the product, never by a model API.

uv run --with faster-whisper==1.2.0 --with requests==2.32.5 python align_words.py manifest.json
The base English model is downloaded once to the normal local model cache.
"""
import difflib
import json
import re
import sys
from pathlib import Path
from faster_whisper import WhisperModel

manifest = Path(sys.argv[1])
data = json.loads(manifest.read_text())
model = WhisperModel(data.get("model", "base.en"), device="cpu", compute_type="int8")
normalize = lambda word: re.sub(r"[^\w]", "", word.lower())
for beat in data["beats"]:
    segments, _ = model.transcribe(beat["path"], language="en", word_timestamps=True,
                                  initial_prompt=beat["say"], condition_on_previous_text=False)
    heard = [w for segment in segments for w in (segment.words or [])]
    source = beat["say"].split()
    aligned = []
    matcher = difflib.SequenceMatcher(None, list(map(normalize, source)),
                                    [normalize(w.word) for w in heard], autojunk=False)
    for block in matcher.get_matching_blocks():
        for index in range(block.size):
            w = heard[block.b + index]
            aligned.append({"word": source[block.a + index], "startMs": round(w.start * 1000),
                            "endMs": round(w.end * 1000)})
    beat["words"] = aligned
    beat["coverage"] = len(aligned) / max(1, len(source))
manifest.with_suffix(".aligned.json").write_text(json.dumps(data, indent=2))
print(json.dumps({"beats": len(data["beats"]), "coverage": [b["coverage"] for b in data["beats"]]}))
