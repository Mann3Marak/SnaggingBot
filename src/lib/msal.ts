"use client"
import { PublicClientApplication, type IPublicClientApplication } from '@azure/msal-browser'

let instance: IPublicClientApplication | null = null
let initialized: Promise<void> | null = null

export async function getMsalInstance(): Promise<IPublicClientApplication> {
  if (!instance) {
    const clientId = process.env.NEXT_PUBLIC_MS_CLIENT_ID as string
    const tenantId = process.env.NEXT_PUBLIC_MS_TENANT_ID as string
    const redirectUri = process.env.NEXT_PUBLIC_MS_REDIRECT_URI as string
    if (!clientId || !tenantId || !redirectUri) {
      throw new Error('Missing Microsoft OAuth env (clientId/tenantId/redirectUri)')
    }
    instance = new PublicClientApplication({
      auth: {
        clientId,
        authority: `https://login.microsoftonline.com/${tenantId}`,
        redirectUri,
        navigateToLoginRequestUrl: false,
      },
      cache: {
        cacheLocation: 'localStorage',
        storeAuthStateInCookie: false,
      },
    })
  }
  if (!initialized) {
    initialized = instance.initialize()
  }
  await initialized
  return instance
}

export const MS_SCOPES = ['Files.ReadWrite', 'offline_access', 'openid', 'profile']
