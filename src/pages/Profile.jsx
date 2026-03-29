import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { updateProfile, deleteAccount } from '../lib/auth'

const AVATAR_COLORS = [
  { value: '#E8526A', label: 'Coral' },
  { value: '#F5A623', label: 'Gold' },
  { value: '#5BAF7A', label: 'Green' },
  { value: '#6090D0', label: 'Blue' },
  { value: '#C05080', label: 'Rose' },
  { value: '#9070C0', label: 'Purple' },
]

const NATIVE_LANGUAGES = ['English', 'French', 'Spanish', 'Mandarin', 'Japanese', 'Korean', 'Other']
const LEARNING_LANGUAGES = ['Vietnamese', 'French', 'Spanish', 'Mandarin', 'Japanese', 'Korean', 'Other']

export default function Profile({ onNavigate }) {
  const { user, profile, refreshProfile } = useAuth()

  const [displayName, setDisplayName] = useState('')
  const [className, setClassName] = useState('')
  const [avatarColor, setAvatarColor] = useState('#E8526A')
  const [nativeLanguage, setNativeLanguage] = useState('en')
  const [learningLanguage, setLearningLanguage] = useState('vi')

  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState(null)

  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name ?? '')
      setClassName(profile.class_name ?? '')
      setAvatarColor(profile.avatar_color ?? '#E8526A')
      setNativeLanguage(profile.native_language ?? 'en')
      setLearningLanguage(profile.learning_language ?? 'vi')
    }
  }, [profile])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setSaveError(null)
    const { error } = await updateProfile(user.id, {
      display_name: displayName.trim(),
      class_name: className.trim(),
      avatar_color: avatarColor,
      native_language: nativeLanguage,
      learning_language: learningLanguage,
    })
    setSaving(false)
    if (error) {
      setSaveError(error.message)
    } else {
      await refreshProfile()
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2000)
    }
  }

  async function handleDelete() {
    if (deleteConfirm !== 'DELETE') return
    setDeleting(true)
    await deleteAccount()
    onNavigate('login')
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 md:px-8 space-y-6">
      {/* Back button */}
      <button
        onClick={() => onNavigate('home')}
        className="flex items-center gap-1.5 text-sm text-co-muted dark:text-gray-400 hover:text-co-primary dark:hover:text-co-primary transition-colors cursor-pointer"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
          <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
        </svg>
        Back
      </button>

      <h1 className="font-display text-2xl font-bold text-co-ink dark:text-gray-100">My Profile</h1>

      {/* Account section */}
      <form onSubmit={handleSave} className="bg-white dark:bg-gray-900 rounded-2xl border border-co-border dark:border-gray-700 p-5 space-y-4">
        <h2 className="font-semibold text-co-ink dark:text-gray-100">Account</h2>

        <div className="space-y-1">
          <label className="text-sm text-co-muted dark:text-gray-400">Display name</label>
          <input
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            className="w-full border border-co-border dark:border-gray-600 rounded-xl px-4 py-3 text-base bg-white dark:bg-gray-800 text-co-ink dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-co-primary transition-shadow"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-co-muted dark:text-gray-400">Class</label>
          <input
            value={className}
            onChange={e => setClassName(e.target.value)}
            placeholder="e.g. Vietnamese 101 — Spring 2026"
            className="w-full border border-co-border dark:border-gray-600 rounded-xl px-4 py-3 text-base bg-white dark:bg-gray-800 text-co-ink dark:text-gray-100 placeholder-co-muted dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-co-primary transition-shadow"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm text-co-muted dark:text-gray-400">Email</label>
          <div className="flex items-center gap-2 border border-co-border dark:border-gray-600 rounded-xl px-4 py-3 bg-co-surface dark:bg-gray-800">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-co-muted dark:text-gray-500 flex-shrink-0" aria-hidden="true">
              <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
            </svg>
            <span className="text-sm text-co-muted dark:text-gray-400 truncate">{user?.email}</span>
          </div>
        </div>

        {saveError && <p className="text-sm text-red-500">{saveError}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full sm:w-auto bg-co-primary text-white px-6 py-3 rounded-full font-semibold disabled:opacity-50 hover:enabled:scale-105 active:enabled:scale-95 transition-all cursor-pointer disabled:cursor-default"
        >
          {saving ? 'Saving…' : saveSuccess ? 'Saved!' : 'Save changes'}
        </button>
      </form>

      {/* Avatar color section */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-co-border dark:border-gray-700 p-5 space-y-3">
        <h2 className="font-semibold text-co-ink dark:text-gray-100">Profile color</h2>
        <div className="flex gap-3 flex-wrap">
          {AVATAR_COLORS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setAvatarColor(value)}
              className="w-10 h-10 rounded-full flex items-center justify-center transition-transform hover:scale-110 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-co-primary"
              style={{ background: value }}
              aria-label={`${label} color${avatarColor === value ? ' (selected)' : ''}`}
            >
              {avatarColor === value && (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="white" className="w-5 h-5" aria-hidden="true">
                  <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Language settings */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-co-border dark:border-gray-700 p-5 space-y-4">
        <h2 className="font-semibold text-co-ink dark:text-gray-100">Language settings</h2>

        <div className="space-y-1">
          <label className="text-sm text-co-muted dark:text-gray-400">Native language</label>
          <select
            value={nativeLanguage}
            onChange={e => setNativeLanguage(e.target.value)}
            className="w-full border border-co-border dark:border-gray-600 rounded-xl px-4 py-3 text-base bg-white dark:bg-gray-800 text-co-ink dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-co-primary transition-shadow cursor-pointer"
          >
            {NATIVE_LANGUAGES.map(lang => (
              <option key={lang} value={lang.toLowerCase().slice(0, 2)}>{lang}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm text-co-muted dark:text-gray-400">Learning language</label>
          <select
            value={learningLanguage}
            onChange={e => setLearningLanguage(e.target.value)}
            className="w-full border border-co-border dark:border-gray-600 rounded-xl px-4 py-3 text-base bg-white dark:bg-gray-800 text-co-ink dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-co-primary transition-shadow cursor-pointer"
          >
            {LEARNING_LANGUAGES.map(lang => (
              <option key={lang} value={lang.toLowerCase().slice(0, 2)}>{lang}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Danger zone */}
      <div className="rounded-2xl border border-red-300 dark:border-red-800 p-5 space-y-3">
        <h2 className="font-semibold text-co-ink dark:text-gray-100" style={{ fontFamily: 'var(--font-pixel-ui)' }}>
          Delete account
        </h2>
        <p className="text-sm text-co-muted dark:text-gray-400">
          Permanently delete your account and all your flashcards, weeks, and progress. This cannot be undone.
        </p>

        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="border border-red-400 dark:border-red-600 text-red-500 dark:text-red-400 px-4 py-2 rounded-xl text-sm hover:bg-red-50 dark:hover:bg-red-950 transition-colors cursor-pointer"
          >
            Delete my account
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-co-ink dark:text-gray-200">Type <strong>DELETE</strong> to confirm</p>
            <input
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              placeholder="DELETE"
              className="w-full border border-red-300 dark:border-red-700 rounded-xl px-4 py-3 text-base bg-white dark:bg-gray-800 text-co-ink dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 transition-shadow"
            />
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={deleteConfirm !== 'DELETE' || deleting}
                className="bg-red-500 text-white px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40 hover:enabled:bg-red-600 active:enabled:scale-95 transition-all cursor-pointer disabled:cursor-default"
              >
                {deleting ? 'Deleting…' : 'Confirm delete'}
              </button>
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteConfirm('') }}
                disabled={deleting}
                className="px-4 py-2 rounded-xl text-sm text-co-muted dark:text-gray-400 hover:text-co-ink dark:hover:text-gray-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
