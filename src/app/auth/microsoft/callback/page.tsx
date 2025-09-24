"use client"
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getMsalInstance, MS_SCOPES } from '@/lib/msal'

export default function MicrosoftCallbackPage() {
  const router = useRouter()
  const [status, setStatus] = useState('Completing Microsoft sign‑in...')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      try {
        const msal = await getMsalInstance()
        const url = new URL(window.location.href)
        const errorParam = url.searchParams.get('error') || url.hash.includes('error=')
        if (errorParam) {
          setError('Microsoft returned an error during login')
          return
        }

        const result = await msal.handleRedirectPromise()
        // Prefer token from result, otherwise from cache
        let account = result?.account ?? msal.getAllAccounts()[0]
        if (!account) {
          // Retry interactive login once with a prompt to select account
          const retried = sessionStorage.getItem('nhome_login_retry')
          if (!retried) {
            sessionStorage.setItem('nhome_login_retry', '1')
            await msal.loginRedirect({ scopes: MS_SCOPES, prompt: 'select_account' })
            return
          }
          setError('No Microsoft account found after redirect')
          return
        }
        const tokenResp = await msal.acquireTokenSilent({ account, scopes: MS_SCOPES })
        const access_token = tokenResp.accessToken
        setStatus('Storing secure session...')
        const resp = await fetch('/api/auth/microsoft/set-token', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ access_token, expires_in: tokenResp.expiresOn ? Math.max(60, Math.floor((tokenResp.expiresOn.getTime() - Date.now()) / 1000)) : 3600 }),
        })
        if (!resp.ok) throw new Error('Failed to persist session')
        const ret = sessionStorage.getItem('nhome_return_url') || '/'
        sessionStorage.removeItem('nhome_return_url')
        sessionStorage.removeItem('nhome_login_retry')
        router.replace(ret)
      } catch (e: any) {
        setError(e?.message ?? 'Microsoft login failed')
      }
    })()
  }, [router])

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-lg">{status}</div>
        {error && <div className="text-red-600 mt-2">{error}</div>}
      </div>
    </main>
  )
}
