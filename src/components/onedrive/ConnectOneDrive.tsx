"use client"
import { useEffect, useState } from 'react'
import { getMsalInstance, MS_SCOPES } from '@/lib/msal'

export function ConnectOneDrive() {
  const [connected, setConnected] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function refreshStatus() {
    try {
      setError(null)
      const resp = await fetch('/api/auth/nhome-microsoft-token', { cache: 'no-store' })
      setConnected(resp.ok)
    } catch {
      setConnected(false)
    }
  }

  useEffect(() => { refreshStatus() }, [])

  const connect = async () => {
    try {
      setLoading(true)
      setError(null)
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('nhome_return_url', window.location.href)
      }
      const msal = await getMsalInstance()
      await msal.loginRedirect({ scopes: MS_SCOPES })
    } catch (e: any) {
      setError(e?.message ?? 'Failed to start Microsoft login')
      setLoading(false)
    }
  }

  const disconnect = async () => {
    try {
      await fetch('/api/auth/microsoft/logout', { method: 'POST' })
      setConnected(false)
    } catch {}
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      {connected ? (
        <>
          <span className="text-emerald-600">Connected to OneDrive</span>
          <button onClick={disconnect} className="text-gray-600 hover:underline">Disconnect</button>
        </>
      ) : (
        <>
          <span className="text-gray-600">OneDrive not connected</span>
          <button onClick={connect} disabled={loading} className="text-nhome-primary hover:underline">
            {loading ? 'Opening Microsoft...' : 'Connect OneDrive'}
          </button>
          {error && <span className="text-red-600">{error}</span>}
        </>
      )}
    </div>
  )
}
