import { useState, useEffect } from 'react'
import { AuthProvider } from './context/AuthContext'
import AuthGuard from './components/AuthGuard'
import Header from './components/Header'
import AuthCallback from './pages/AuthCallback'
import Login from './pages/Login'
import Privacy from './pages/Privacy'
import Profile from './pages/Profile'
import Home from './pages/Home'
import Week from './pages/Week'
import Study from './pages/Study'
import Quiz from './pages/Quiz'
import LotusQuest from './pages/LotusQuest'
import Diagnostics from './pages/Diagnostics'
import { loadCategories } from './lib/categories'
import { logError } from './lib/logger'

function AppInner() {
  // If the browser is on /auth/callback, show that page immediately
  const isCallback = window.location.pathname.includes('/auth/callback')

  const [view, setView] = useState(() => {
    if (isCallback) return { page: 'auth/callback', weekId: null, loginError: null, justCopied: false }
    return { page: 'home', weekId: null, loginError: null, justCopied: false }
  })
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('theme')
    if (saved) return saved === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  const [categories, setCategories] = useState([])

  useEffect(() => {
    loadCategories()
      .then(setCategories)
      .catch(err => logError('Failed to load categories on app init', { action: 'loadCategories', err }))
  }, [])

  function navigate(page, weekId = null, loginError = null, opts = {}) {
    setView({ page, weekId, loginError, justCopied: opts.justCopied ?? false })
  }

  function toggleDark() {
    setDark(d => {
      const next = !d
      localStorage.setItem('theme', next ? 'dark' : 'light')
      return next
    })
  }

  const themeProps = { dark, onToggleDark: toggleDark }

  // Public pages (no auth required)
  if (view.page === 'auth/callback') {
    return <AuthCallback onNavigate={navigate} />
  }
  if (view.page === 'privacy') {
    return (
      <div className={`${dark ? 'dark' : ''} min-h-screen bg-co-warm dark:bg-gray-950 transition-colors duration-200`}>
        <Privacy onNavigate={navigate} />
      </div>
    )
  }

  // Auth-protected pages
  return (
    <div className={`${dark ? 'dark' : ''} min-h-screen bg-co-warm dark:bg-gray-950 transition-colors duration-200`}>
      <AuthGuard onNavigate={navigate} loginError={view.loginError}>
        <Header dark={dark} onToggleDark={toggleDark} onNavigate={navigate} />
        {view.page === 'week' ? (
          <Week weekId={view.weekId} onNavigate={navigate} {...themeProps} categories={categories} onCategoriesChange={setCategories} justCopied={view.justCopied} />
        ) : view.page === 'study' ? (
          <Study weekId={view.weekId} onNavigate={navigate} {...themeProps} />
        ) : view.page === 'quiz' ? (
          <Quiz weekId={view.weekId} onNavigate={navigate} {...themeProps} />
        ) : view.page === 'lotus-quest' ? (
          <LotusQuest weekId={view.weekId} onNavigate={navigate} />
        ) : view.page === 'profile' ? (
          <Profile onNavigate={navigate} {...themeProps} />
        ) : view.page === 'diagnostics' && import.meta.env.DEV ? (
          <Diagnostics onNavigate={navigate} {...themeProps} />
        ) : (
          <Home onNavigate={navigate} {...themeProps} />
        )}
      </AuthGuard>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  )
}
