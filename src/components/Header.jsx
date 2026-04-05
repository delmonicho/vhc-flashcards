import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import ThemeToggle from './ThemeToggle'

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

export default function Header({ dark, onToggleDark, onNavigate }) {
  return (
    <header className="flex items-center justify-end gap-2 px-4 py-3 md:px-8">
      <ThemeToggle dark={dark} onToggle={onToggleDark} />
      <UserMenu onNavigate={onNavigate} />
    </header>
  )
}
