import { useAuth } from '../context/AuthContext'
import LotusLoader from './LotusLoader'
import Login from '../pages/Login'

export default function AuthGuard({ children, onNavigate, loginError }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0d1018' }}>
        <LotusLoader size={80} />
      </div>
    )
  }

  if (!user) {
    return <Login onNavigate={onNavigate} loginError={loginError} />
  }

  return children
}
