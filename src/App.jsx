import { useState } from 'react'
import Home from './pages/Home'
import Week from './pages/Week'
import Study from './pages/Study'
import BreakdownImport from './pages/BreakdownImport'

export default function App() {
  const [view, setView] = useState({ page: 'home', weekId: null })
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('theme')
    if (saved) return saved === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

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
        <Week weekId={view.weekId} onNavigate={navigate} {...themeProps} />
      ) : view.page === 'study' ? (
        <Study weekId={view.weekId} onNavigate={navigate} {...themeProps} />
      ) : view.page === 'import' ? (
        <BreakdownImport onNavigate={navigate} {...themeProps} />
      ) : (
        <Home onNavigate={navigate} {...themeProps} />
      )}
    </div>
  )
}
