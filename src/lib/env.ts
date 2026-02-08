const cached = {
  openAI: null as null | OpenAIConfig,
  smtp: null as null | NHomeSmtpConfig,
  supabase: null as null | SupabaseConfig,
}

type OpenAIConfig = {
  apiKey: string
  baseUrl: string
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
  cached.smtp = null
  cached.supabase = null
}
