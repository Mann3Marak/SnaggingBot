export interface EnvCheckResult {
  ok: boolean
  message?: string
  missing?: string[]
}

function isValueMissing(value: string | undefined | null) {
  return value === undefined || value === null || value === ''
}

export function ensureEnv(context: string, keys: string[]): EnvCheckResult {
  const missing = keys.filter((key) => isValueMissing(process.env[key]))
  if (missing.length > 0) {
    const message = `${context} is missing required environment variables: ${missing.join(', ')}`
    if (typeof console !== 'undefined') {
      console.error(`[env] ${message}`)
    }
    return { ok: false, message, missing }
  }
  return { ok: true }
}

export function getEnv(key: string, context: string): string {
  const value = process.env[key]
  if (isValueMissing(value)) {
    const message = `${context} requires ${key}`
    if (typeof console !== 'undefined') {
      console.error(`[env] ${message}`)
    }
    throw new Error(message)
  }
  return value as string
}
