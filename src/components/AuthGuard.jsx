import { useAuth } from '../context/AuthContext'
import Logo from './Logo'
import Login from '../pages/Login'

export default function AuthGuard({ children, onNavigate, loginError }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0d1018' }}>
        <div className="animate-pulse">
          <Logo size="md" />
        </div>
      </div>
    )
  }

  if (!user) {
    return <Login onNavigate={onNavigate} loginError={loginError} />
  }

  return children
}
