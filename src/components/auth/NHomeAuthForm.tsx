i'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import { NHomeLogo } from '@/components/NHomeLogo'

export function NHomeAuthForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const router = useRouter()
  const params = useSearchParams()

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setInfo(null)

    try {
      if (isSignUp) {
        const { error } = await getSupabase().auth.signUp({ email, password })
        if (error) throw error
        setInfo('Check your inbox to confirm your email. An admin may need to approve access.')
      } else {
        const { data, error } = await getSupabase().auth.signInWithPassword({ email, password })
        if (error) throw error
        if (data.session) router.replace('/dashboard')
      }
    } catch (err: any) {
      setError(err?.message ?? 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  const message = params.get('message')

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50">
      <div className="flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <NHomeLogo variant="primary" size="xl" className="mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-nhome-primary mb-2">NHome Inspection Pro</h1>
            <p className="text-lg font-medium text-gray-700 mb-1">Professional Property Inspections</p>
            <p className="text-sm text-gray-500 mb-6">Your Property Setup and Management Partner in the Algarve</p>
            <div className="text-xs text-gray-400">Founded by Natalie O'Kelly - Algarve, Portugal</div>
          </div>

          {message && (
            <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">{message}</div>
          )}
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
          )}
          {info && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{info}</div>
          )}

          <div className="bg-white py-8 px-6 shadow-xl rounded-xl border border-gray-200">
            <form onSubmit={handleAuth} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                <input
                  id="email"
                  type="email"
                  placeholder="inspector@nhomesetup.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nhome-primary focus:border-transparent transition-colors"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                <input
                  id="password"
                  type="password"
                  placeholder="Enter your secure password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nhome-primary focus:border-transparent transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-nhome-primary hover:bg-nhome-primary-dark disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-200 transform hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-nhome-primary focus:ring-offset-2"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Please wait...
                  </div>
                ) : (
                  isSignUp ? 'Join NHome Team' : 'Sign In to NHome'
                )}
              </button>
            </form>
            <div className="mt-6 text-center">
              <button
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-nhome-primary hover:text-nhome-primary-dark font-medium text-sm transition-colors"
              >
                {isSignUp
                  ? 'Already part of the NHome team? Sign In'
                  : 'New to NHome? Contact admin for access'}
              </button>
            </div>
          </div>

          <div className="text-center">
            <p className="text-xs text-gray-500">
              Copyright 2024 NHome Property Setup & Management
              <br />Professional Property Services in the Algarve
              <br />
              <a href="https://www.nhomesetup.com" target="_blank" rel="noopener noreferrer" className="text-nhome-secondary hover:underline">www.nhomesetup.com</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}


