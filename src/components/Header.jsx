import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import ThemeToggle from './ThemeToggle'
import BugReportModal from './BugReportModal'

function MantisIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-[18px] h-[18px]" aria-hidden="true">
      {/* Antennae */}
      <line x1="9" y1="2.5" x2="5" y2="0.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <line x1="11" y1="2.5" x2="15" y2="0.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      {/* Head */}
      <circle cx="10" cy="4" r="2" />
      {/* Body */}
      <rect x="9" y="6" width="2" height="10" rx="1" />
      {/* Left raised foreleg */}
      <path d="M9.5 8 L4 6 L3.5 8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Right raised foreleg */}
      <path d="M10.5 8 L16 6 L16.5 8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Hind legs */}
      <line x1="9.5" y1="13" x2="6" y2="16" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <line x1="10.5" y1="13" x2="14" y2="16" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  )
}

function UserMenu({ onNavigate }) {
  const { user, profile, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  async function handleSignOut() {
    setOpen(false)
    await signOut()
    onNavigate('login')
  }

  const initial = profile?.display_name?.[0]?.toUpperCase() ?? '?'
  const color = profile?.avatar_color ?? '#FF6B47'
  const icon = user ? (localStorage.getItem(`avatar-icon-${user.id}`) ?? null) : null

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 rounded-full px-2 py-1 hover:bg-co-surface dark:hover:bg-gray-800 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-co-primary focus:ring-offset-2"
        aria-label="User menu"
      >
        {/* Avatar circle */}
        <span
          className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
          style={{ background: color, fontFamily: 'var(--font-pixel-ui)' }}
          aria-hidden="true"
        >
          {icon ?? initial}
        </span>
        {/* Display name */}
        <span
          className="text-sm text-co-ink dark:text-gray-100 truncate hidden sm:block"
          style={{ maxWidth: '120px' }}
        >
          {profile?.display_name ?? ''}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-52 rounded-2xl border border-co-border dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl z-50 py-1 overflow-hidden">
          {/* User info header */}
          <div className="px-4 py-3 border-b border-co-border dark:border-gray-700">
            <p className="text-xs font-medium text-co-muted dark:text-gray-400 truncate">
              {profile?.display_name ?? ''}
            </p>
            <p className="text-xs text-co-muted dark:text-gray-500 truncate mt-0.5">
              {user?.email ?? ''}
            </p>
          </div>
          {/* Menu items */}
          <button
            onClick={() => { setOpen(false); onNavigate('profile') }}
            className="w-full text-left px-4 py-2.5 text-sm text-co-ink dark:text-gray-200 hover:bg-co-surface dark:hover:bg-gray-800 transition-colors cursor-pointer"
          >
            My Profile
          </button>
          <button
            onClick={handleSignOut}
            className="w-full text-left px-4 py-2.5 text-sm text-co-ink dark:text-gray-200 hover:bg-co-surface dark:hover:bg-gray-800 transition-colors cursor-pointer"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

export default function Header({ dark, onToggleDark, onNavigate, currentPage }) {
  const [bugOpen, setBugOpen] = useState(false)
  return (
    <header className="flex items-center justify-end gap-2 px-4 py-3 md:px-8">
      <ThemeToggle dark={dark} onToggle={onToggleDark} />
      <button
        onClick={() => setBugOpen(true)}
        aria-label="Report a bug"
        className="w-9 h-9 flex items-center justify-center rounded-full text-co-muted dark:text-gray-400 hover:text-co-primary dark:hover:text-co-primary hover:bg-co-surface dark:hover:bg-gray-800 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-co-primary focus:ring-offset-2"
      >
        <MantisIcon />
      </button>
      <UserMenu onNavigate={onNavigate} />
      {bugOpen && <BugReportModal currentPage={currentPage} onClose={() => setBugOpen(false)} />}
    </header>
  )
}
