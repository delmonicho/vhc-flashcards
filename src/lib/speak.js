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

export function isVoiceAvailable(langCode) {
  const prefix = langCode.split('-')[0]
  return cachedVoices.some(v => v.lang.startsWith(prefix))
}

// Legacy alias — kept for call sites not yet updated
export function isVietnameseVoiceAvailable() {
  return isVoiceAvailable('vi')
}

export function cancelSpeech() {
  window.speechSynthesis?.cancel()
}

// Must be called synchronously within a user gesture handler (iOS requirement).
// Uses cachedVoices (pre-loaded at module init) so no await is needed before speak().
// langCode: BCP 47 tag e.g. 'vi-VN', 'zh-CN', 'zh-TW'
export function speak(text, langCode = 'vi-VN', options = {}) {
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

    const prefix = langCode.split('-')[0]
    const voice = cachedVoices.find(v => v.lang.startsWith(prefix))
    if (voice) utterance.voice = voice

    utterance.onend = () => resolve()
    utterance.onerror = e => reject(e)

    speechSynthesis.speak(utterance)
  })
}

// Legacy alias
export function speakVietnamese(text, options = {}) {
  return speak(text, 'vi-VN', options)
}

// Returns the BCP 47 lang code for a deck's language/script
export function deckLangCode(language, script) {
  if (language === 'zh') return script === 'traditional' ? 'zh-TW' : 'zh-CN'
  return 'vi-VN'
}
