'use client'
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md border-t-4" style={{ borderColor: '#2b388f' }}>
        <div className="text-center mb-8">
          <img 
            src="https://gfevpvqpaujhorgbjmll.supabase.co/storage/v1/object/public/assets/panelclad_02@3x.png" 
            alt="PanelClad Logo" 
            className="h-32 w-auto mx-auto mb-4"
            onError={(e) => {
              e.target.style.display = 'none'
              e.target.nextElementSibling.style.display = 'flex'
            }}
          />
          <div className="hidden w-24 h-24 mx-auto mb-4 rounded-lg items-center justify-center" style={{ backgroundColor: '#2b388f' }}>
            <span className="text-white text-4xl font-bold">PC</span>
          </div>
          <h1 className="text-3xl font-bold mb-2" style={{ color: '#1e1e21' }}>
            Fab Shop Tracker
          </h1>
          <p className="text-gray-600">PanelClad Project Management</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent focus:outline-none transition-all"
              style={{ focusRingColor: '#2b388f' }}
              placeholder="your@email.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent focus:outline-none transition-all"
              placeholder="••••••••"
            />
          </div>
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-200">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full text-white py-3 rounded-lg font-semibold hover:opacity-90 transition-all disabled:bg-gray-400 shadow-md"
            style={{ backgroundColor: '#2b388f' }}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>Contact your manager for login credentials</p>
        </div>
      </div>
    </div>
  )
}