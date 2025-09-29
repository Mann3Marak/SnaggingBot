const cached = {
  openAI: null as null | OpenAIConfig,
  microsoft: null as null | MicrosoftGraphConfig,
  smtp: null as null | NHomeSmtpConfig,
  supabase: null as null | SupabaseConfig,
}

type OpenAIConfig = {
  apiKey: string
  baseUrl: string
}

type MicrosoftGraphConfig = {
  tenant?: string
  clientId?: string
  clientSecret?: string
  driveId?: string
  hasClientCredentials: boolean
  hasPartialCredentials: boolean
}

type NHomeSmtpConfig = {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
}

type SupabaseConfig = {
  url: string
  anonKey: string
}

export function assertEnv(name: string): string
export function assertEnv(name: string, optional: true): string | undefined
export function assertEnv(name: string, optional = false): string | undefined {
  const value = process.env[name]?.trim()
  if (!value && !optional) {
    throw new Error(`[env] Missing required environment variable ${name}`)
  }
  return value
}

export function getOpenAIConfig(): OpenAIConfig {
  const cachedValue = cached.openAI
  if (cachedValue) return cachedValue
  const apiKey = assertEnv('OPENAI_API_KEY')
  const baseUrl = process.env.OPENAI_BASE_URL?.trim() || 'https://api.openai.com'
  const config: OpenAIConfig = { apiKey, baseUrl }
  cached.openAI = config
  return config
}

export function getMicrosoftGraphConfig(): MicrosoftGraphConfig {
  const cachedValue = cached.microsoft
  if (cachedValue) return cachedValue
  const tenant = process.env.MS_TENANT_ID?.trim()
  const clientId = process.env.MS_CLIENT_ID?.trim()
  const clientSecret = process.env.MS_CLIENT_SECRET?.trim()
  const driveId = (process.env.NEXT_PUBLIC_MS_DRIVE_ID || process.env.MS_DRIVE_ID)?.trim()
  const provided = [tenant, clientId, clientSecret].filter(Boolean).length
  const config: MicrosoftGraphConfig = {
    tenant,
    clientId,
    clientSecret,
    driveId,
    hasClientCredentials: provided === 3,
    hasPartialCredentials: provided > 0 && provided < 3,
  }
  cached.microsoft = config
  return config
}

export function getMicrosoftGraphClientCredentials(): { tenant: string; clientId: string; clientSecret: string } {
  const config = getMicrosoftGraphConfig()
  const missing: string[] = []
  if (!config.tenant) missing.push('MS_TENANT_ID')
  if (!config.clientId) missing.push('MS_CLIENT_ID')
  if (!config.clientSecret) missing.push('MS_CLIENT_SECRET')
  if (missing.length) {
    throw new Error(`[env] Missing Microsoft Graph configuration: ${missing.join(', ')}`)
  }
  return {
    tenant: config.tenant!,
    clientId: config.clientId!,
    clientSecret: config.clientSecret!,
  }
}

export function getNHomeSmtpConfig(): NHomeSmtpConfig {
  const cachedValue = cached.smtp
  if (cachedValue) return cachedValue
  const host = assertEnv('NHOME_SMTP_HOST')
  const user = assertEnv('NHOME_EMAIL')
  const pass = assertEnv('NHOME_EMAIL_PASSWORD')
  const rawPort = process.env.NHOME_SMTP_PORT?.trim()
  const port = rawPort ? Number(rawPort) : 587
  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`[env] Invalid NHOME_SMTP_PORT value: ${rawPort}`)
  }
  const secure = process.env.NHOME_SMTP_SECURE === 'true' || port === 465
  const config: NHomeSmtpConfig = { host, port, secure, user, pass }
  cached.smtp = config
  return config
}

export function getSupabaseServiceConfig(): SupabaseConfig {
  const cachedValue = cached.supabase
  if (cachedValue) return cachedValue
  const url = assertEnv('NEXT_PUBLIC_SUPABASE_URL')
  const anonKey = assertEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  const config: SupabaseConfig = { url, anonKey }
  cached.supabase = config
  return config
}

export function resetEnvCache() {
  cached.openAI = null
  cached.microsoft = null
  cached.smtp = null
  cached.supabase = null
}
