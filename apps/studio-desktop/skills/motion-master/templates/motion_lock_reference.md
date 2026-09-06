# motion_lock.md — exact contract

First line: `<!-- motion-master-schema: lock/v1 -->`. Anchors only; never beat-local values.

```
- preset: technical-trace | premium-settle | data-confirm
- tokens: <column name from references/tokens.md and the stage/speaker tables>
- durationScale: 1.0 · speed: 1.0 · reducedMotion: false · aspect: 16:9
- stage.base: <family> (per block: <blockId>: <family>)
- roster: [{id, name, role, source, colour, side}]
- nextOwner: <id>
- turnPolicy: {source: auto, dominant: true, overlap: equalize}
- clocks: recorded > cue > formula
- budgets: beat 1600 · attentional 600 · camera 2000 · newUnits 5 · newRels 2 · overlays 2
- validator: errors block present/publish, never save; warnings never block
```
