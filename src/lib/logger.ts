type LogLevel = "debug" | "info" | "warn" | "error";

const levelPriority: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function getConfiguredLevel(): LogLevel {
  const configured = (process.env.LOG_LEVEL || "").toLowerCase();
  if (configured === "debug" || configured === "info" || configured === "warn" || configured === "error") {
    return configured;
  }
  return process.env.NODE_ENV === "production" ? "warn" : "info";
}

function shouldLog(level: LogLevel): boolean {
  const minLevel = getConfiguredLevel();
  return levelPriority[level] >= levelPriority[minLevel];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactValue);
  }
  if (!isPlainObject(value)) {
    return value;
  }

  const redacted: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value)) {
    const normalized = key.toLowerCase();
    if (
      normalized.includes("token") ||
      normalized.includes("password") ||
      normalized.includes("secret") ||
      normalized.includes("authorization") ||
      normalized.includes("apikey") ||
      normalized.includes("api_key")
    ) {
      redacted[key] = "[REDACTED]";
    } else {
      redacted[key] = redactValue(inner);
    }
  }
  return redacted;
}

function write(level: LogLevel, message: string, meta?: unknown): void {
  if (!shouldLog(level)) return;
  const payload = meta === undefined ? undefined : redactValue(meta);
  if (level === "debug") {
    if (payload === undefined) console.debug(message);
    else console.debug(message, payload);
    return;
  }
  if (level === "info") {
    if (payload === undefined) console.info(message);
    else console.info(message, payload);
    return;
  }
  if (level === "warn") {
    if (payload === undefined) console.warn(message);
    else console.warn(message, payload);
    return;
  }
  if (payload === undefined) console.error(message);
  else console.error(message, payload);
}

export const logger = {
  debug(message: string, meta?: unknown) {
    write("debug", message, meta);
  },
  info(message: string, meta?: unknown) {
    write("info", message, meta);
  },
  warn(message: string, meta?: unknown) {
    write("warn", message, meta);
  },
  error(message: string, meta?: unknown) {
    write("error", message, meta);
  },
};

