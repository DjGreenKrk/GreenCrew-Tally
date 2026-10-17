'use strict'
// Match the complete UDP payload strictly after this phase's checkpoint.
function hasFrameSince(frames, checkpoint, expected) {
  if (!Number.isInteger(checkpoint) || checkpoint < 0 || checkpoint > frames.length) {
    throw new RangeError('Invalid UDP phase checkpoint')
  }
  return frames.slice(checkpoint).some(frame => frame === expected)
}
module.exports = { hasFrameSince }
