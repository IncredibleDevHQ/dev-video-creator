# Plan Stage

Runs inside motion-master Step 6 for every beat when presence ≥ 1.

1. **Base family** per block from §8.3 (density → intent → block kind → gesture → rhythm caps); legacy blocks keep today's rects (`legacyGeometry`).
2. **Required-area class** per beat (§28.2): none / slot / beside / frame / takeover; hard gate text ≥ 18 px @1080.
3. **Score** every candidate family (§28.3); pick the primary; keep ≤ 2 alternates within 15 points.
4. **Treatment** for slot/beside beats (§28.6): overlay, bed, separate, glow-bed hero (≤ 1 per scene, author accepts), text-behind.
5. **Smooth** into the layout track (§28.4): open on the person 8 s, merge stays < 4 s, cap 2–4 changes/min, prefer returning reframes, close on the person. Write `motion/track.json`.
6. **Materialise** stage events (family changes as reframes or cuts, §10) and slot members as overlay units; `resolve` handles timing; `validate` checks zones, band, dwell, presence floor.
