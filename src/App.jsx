import { useState, useEffect } from 'react'
import { AuthProvider } from './context/AuthContext'
import AuthGuard from './components/AuthGuard'
import Header from './components/Header'
import AuthCallback from './pages/AuthCallback'
import Login from './pages/Login'
import Privacy from './pages/Privacy'
import Profile from './pages/Profile'
import Home from './pages/Home'
import Deck from './pages/Deck'
import Study from './pages/Study'
import Quiz from './pages/Quiz'
import LotusQuest from './pages/LotusQuest'
import Diagnostics from './pages/Diagnostics'
import { loadCategories } from './lib/categories'
import { logError } from './lib/logger'

function buildPath(page, deckId) {
  if (['deck', 'study', 'quiz', 'lotus-quest'].includes(page)) return `/${page}/${deckId}`
  if (page === 'home') return '/'
  return `/${page}`
}

function parsePath(pathname) {
  const parts = pathname.replace(/^\//, '').split('/')
  const page = parts[0] || 'home'
  if (['deck', 'study', 'quiz', 'lotus-quest'].includes(page) && parts[1]) return { page, deckId: parts[1] }
  if (page === 'auth' && parts[1] === 'callback') return { page: 'auth/callback', deckId: null }
  if (['profile', 'login', 'auth', 'privacy', 'diagnostics'].includes(page)) return { page, deckId: null }
  return { page: 'home', deckId: null }
}

function AppInner() {
  const [view, setView] = useState(() => {
    const { page, deckId } = parsePath(window.location.pathname)
    return { page, deckId, loginError: null, justCopied: false }
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

  useEffect(() => {
    history.replaceState({ page: view.page, deckId: view.deckId }, '', window.location.href)
    function handlePop(e) {
      const { page, deckId } = e.state ?? parsePath(window.location.pathname)
      setView({ page, deckId: deckId ?? null, loginError: null, justCopied: false })
    }
    window.addEventListener('popstate', handlePop)
    return () => window.removeEventListener('popstate', handlePop)
  }, [])

  function navigate(page, deckId = null, loginError = null, opts = {}) {
    const path = buildPath(page, deckId)
    history.pushState({ page, deckId }, '', path)
    setView({ page, deckId, loginError, justCopied: opts.justCopied ?? false })
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
        {view.page === 'deck' ? (
          <Deck deckId={view.deckId} onNavigate={navigate} {...themeProps} categories={categories} onCategoriesChange={setCategories} justCopied={view.justCopied} />
        ) : view.page === 'study' ? (
          <Study deckId={view.deckId} onNavigate={navigate} {...themeProps} />
        ) : view.page === 'quiz' ? (
          <Quiz deckId={view.deckId} onNavigate={navigate} {...themeProps} />
        ) : view.page === 'lotus-quest' ? (
          <LotusQuest deckId={view.deckId} onNavigate={navigate} />
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
