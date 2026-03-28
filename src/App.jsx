import { useState, useEffect } from 'react'
import Home from './pages/Home'
import Week from './pages/Week'
import Study from './pages/Study'
import Quiz from './pages/Quiz'
import LotusQuest from './pages/LotusQuest'
import Diagnostics from './pages/Diagnostics'
import { loadCategories } from './lib/categories'
import { logError } from './lib/logger'

export default function App() {
  const [view, setView] = useState({ page: 'home', weekId: null })
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

  function navigate(page, weekId = null) {
    setView({ page, weekId })
  }

  function toggleDark() {
    setDark(d => {
      const next = !d
      localStorage.setItem('theme', next ? 'dark' : 'light')
      return next
    })
  }

  const themeProps = { dark, onToggleDark: toggleDark }

  return (
    <div className={`${dark ? 'dark' : ''} min-h-screen bg-co-warm dark:bg-gray-950 transition-colors duration-200`}>
      {view.page === 'week' ? (
        <Week weekId={view.weekId} onNavigate={navigate} {...themeProps} categories={categories} onCategoriesChange={setCategories} />
      ) : view.page === 'study' ? (
        <Study weekId={view.weekId} onNavigate={navigate} {...themeProps} />
      ) : view.page === 'quiz' ? (
        <Quiz weekId={view.weekId} onNavigate={navigate} {...themeProps} />
      ) : view.page === 'lotus-quest' ? (
        <LotusQuest weekId={view.weekId} onNavigate={navigate} />
      ) : view.page === 'diagnostics' && import.meta.env.DEV ? (
        <Diagnostics onNavigate={navigate} {...themeProps} />
      ) : (
        <Home onNavigate={navigate} {...themeProps} />
      )}
    </div>
  )
}
