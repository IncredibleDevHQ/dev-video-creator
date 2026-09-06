# Failure recovery — motion-master

| Failure point | Blocking | Automatic recovery | Resume |
|---|---|---|---|
| a beat names a unit the atomiser does not have | yes, for the beat | re-atomise; then repair the brief (the page never changes for motion) | Step 6, current beat |
| planner returns timing, ease or coordinates | yes | reject with the reason; re-run `plan_beats` | Step 4 |
| no take and no word onsets | no | formula clock; plan marked `cue: formula` | Step 6 |
| take feed outside sync tolerance | yes | cross-correlate; else ask for a clap | Reconcile Take step 1 |
| validator error class | yes | one consolidated pass, one rerun | Step 6 gate |
| matte / frame budget fails at rehearsal (stage) | no | chip family before the take; record in the lock | Step 6 |
| layout cue without an intent change | yes, for the beat | drop the cue; keep the beat | Step 6 |
| context lost mid-roster | until rebuilt | read the brief, then the lock, then `resolved.json` for the last completed beat | Step 6, current beat |

**Forbidden — silent downgrade.** Never skip a gate because a downstream command tolerates the missing file; never change a confirmed value to keep the route moving.
