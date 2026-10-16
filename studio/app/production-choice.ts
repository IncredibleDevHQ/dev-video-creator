// The make dialog's choice of how a new video is made, and a storyboard
// video's length: the same slider as the series', for this video.
import { DEFAULT_LENGTH } from '../shared/length'
import type { LengthGoal } from '../shared/storyboard'
import { lengthRange } from './length-range'

/** How a new video is made, and a storyboard video's length. */
export const productionChoice = (length?: [number, number] | LengthGoal) => {
  const goal: LengthGoal = Array.isArray(length)
    ? { min: length[0], max: length[1], strict: false }
    : length || DEFAULT_LENGTH
  return `<fieldset class="production-choice"><legend>How it’s made</legend>
<label><input type="radio" name="production" value="storyboard" checked> Storyboard <small>One plan for the episode, built frame by frame.</small></label>
<label><input type="radio" name="production" value="scenes"> Scene by scene <small>The earlier way, one scene at a time.</small></label>
</fieldset>
<fieldset class="length-choice"><legend>Length</legend>${lengthRange(goal, {
    names: { min: 'length-min', max: 'length-max', strict: 'length-strict' },
    label: 'this video'
  })}</fieldset>`
}
