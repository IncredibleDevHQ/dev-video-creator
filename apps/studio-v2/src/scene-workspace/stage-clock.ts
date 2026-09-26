// A scene's end on the stage (F07 of the project-flow fix verification). A
// scene's clock need not be a whole number of frames — a generated voice
// lasts 31.204 s, and its last frame is at 31.2 s — so the player can stop a
// fraction of a frame short of the clock and never say it ended; and a
// clip's interval is half-open, so the clock's exact end draws nothing. The
// end is read within a frame, and the stage holds the last frame anything
// is drawn on.
export const STAGE_FPS = 30

/** Whether playback at `time` has reached the scene's last frame. */
export const atStageEnd = (time: number, duration: number, fps = STAGE_FPS) =>
  duration > 0 && Number.isFinite(time) && time >= duration - 1 / fps + 1e-6

/** The last frame anything is drawn on: the last before the clock's end. */
export const lastFrameOf = (duration: number, fps = STAGE_FPS) =>
  duration > 0 ? Math.max(0, (Math.ceil(duration * fps - 1e-6) - 1) / fps) : 0
