let cachedToken: { accessToken: string; expiresAt: number } | null = null

function resolveEnv(name: string, fallbackName?: string): string | undefined {
  const value = process.env[name]
  if (!value && fallbackName) {
    return process.env[fallbackName]
  }
  return value
}

async function requestClientCredentialsToken(): Promise<{ access_token: string; expires_in?: number }> {
  const tenant = resolveEnv('MS_TENANT_ID', 'NEXT_PUBLIC_MS_TENANT_ID')
  const clientId = resolveEnv('MS_CLIENT_ID', 'NEXT_PUBLIC_MS_CLIENT_ID')
  const clientSecret = process.env.MS_CLIENT_SECRET

  if (!tenant || !clientId || !clientSecret) {
    throw new Error('Missing Microsoft client credential environment variables (MS_TENANT_ID/MS_CLIENT_ID/MS_CLIENT_SECRET)')
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
  })

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Failed to mint Microsoft Graph app token (${response.status}): ${detail}`)
  }

  return response.json() as Promise<{ access_token: string; expires_in?: number }>
}

export async function getAppGraphToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.accessToken
  }

  const token = await requestClientCredentialsToken()
  const expiresIn = typeof token.expires_in === 'number' ? token.expires_in : 3600
  cachedToken = {
    accessToken: token.access_token,
    // Refresh one minute early to avoid edge-expiry
    expiresAt: Date.now() + Math.max(expiresIn - 60, 60) * 1000,
  }
  return token.access_token
}

export function clearAppGraphTokenCache() {
  cachedToken = null
}
