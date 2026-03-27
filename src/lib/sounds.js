let ctx = null

function getCtx() {
  if (!ctx) ctx = new AudioContext()
  return ctx
}

function note(freq, startTime, duration, type = 'square', gainVal = 0.15, detune = 0) {
  const c = getCtx()
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.connect(gain)
  gain.connect(c.destination)
  osc.type = type
  osc.frequency.value = freq
  osc.detune.value = detune
  gain.gain.setValueAtTime(gainVal, startTime)
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration)
  osc.start(startTime)
  osc.stop(startTime + duration + 0.01)
}

export function playFlip() {
  try {
    const c = getCtx()
    c.resume().catch(() => {})
    note(120, c.currentTime, 0.04, 'square', 0.08)
  } catch {}
}

export function playCorrect() {
  try {
    const c = getCtx()
    c.resume().catch(() => {})
    const t = c.currentTime
    note(261.63, t, 0.08, 'square', 0.15)
    note(329.63, t + 0.08, 0.08, 'square', 0.15)
    note(392, t + 0.16, 0.12, 'square', 0.15)
  } catch {}
}

export function playWrong() {
  try {
    const c = getCtx()
    c.resume().catch(() => {})
    note(200, c.currentTime, 0.2, 'square', 0.15, -10)
  } catch {}
}

export function playVictory() {
  try {
    const c = getCtx()
    c.resume().catch(() => {})
    const t = c.currentTime
    const melody = [261.63, 329.63, 392, 329.63, 392, 523.25]
    melody.forEach((freq, i) => note(freq, t + i * 0.1, 0.09, 'sawtooth', 0.12))
  } catch {}
}
