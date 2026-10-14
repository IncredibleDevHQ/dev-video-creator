// The make dialog's choice of how a new video is made, and a storyboard
// video's length: a range, and whether it must fit.
/** How a new video is made, and a storyboard video's length. */
export const productionChoice = (range?: [number, number]) => {
  const [min, max] = range || [45, 120]
  return `<fieldset class="production-choice"><legend>How it’s made</legend>
<label><input type="radio" name="production" value="storyboard" checked> Storyboard <small>One plan for the episode, built frame by frame.</small></label>
<label><input type="radio" name="production" value="scenes"> Scene by scene <small>The earlier way, one scene at a time.</small></label>
</fieldset>
<fieldset class="length-choice"><legend>Length</legend>
<label>From <input type="number" name="length-min" min="10" max="5400" step="5" value="${min}"> s</label>
<label>to <input type="number" name="length-max" min="15" max="5400" step="5" value="${max}"> s</label>
<label class="length-strict"><input type="checkbox" name="length-strict"> Must fit</label>
</fieldset>`
}
