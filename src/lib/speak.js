let cachedVoices = []

function onVoicesChanged() {
  cachedVoices = speechSynthesis.getVoices()
}

if (typeof window !== 'undefined' && window.speechSynthesis) {
  cachedVoices = speechSynthesis.getVoices()
  speechSynthesis.addEventListener('voiceschanged', onVoicesChanged)
}

export function getAvailableVoices() {
  const vi = cachedVoices.filter(v => v.lang.startsWith('vi'))
  const others = cachedVoices.filter(v => !v.lang.startsWith('vi'))
  return [...vi, ...others]
}

export function isVietnameseVoiceAvailable() {
  return cachedVoices.some(v => v.lang.startsWith('vi'))
}

export function cancelSpeech() {
  window.speechSynthesis?.cancel()
}

// speakVietnamese must be called synchronously from a user gesture (iOS requirement).
// We use cachedVoices (pre-loaded at module init) so no await is needed before speak().
export function speakVietnamese(text, options = {}) {
  return new Promise((resolve, reject) => {
    if (!window.speechSynthesis) {
      reject(new Error('Speech synthesis not supported'))
      return
    }

    speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = options.rate ?? 0.8
    utterance.pitch = options.pitch ?? 1
    utterance.volume = options.volume ?? 1

    const viVoice = cachedVoices.find(v => v.lang.startsWith('vi'))
    if (viVoice) utterance.voice = viVoice

    utterance.onend = () => resolve()
    utterance.onerror = e => reject(e)

    speechSynthesis.speak(utterance)
  })
}
