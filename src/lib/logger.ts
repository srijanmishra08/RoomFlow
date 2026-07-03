// Minimal structured JSON logger. Emits one JSON object per line so log
// aggregators (Datadog, Loki, CloudWatch) can parse fields without regex.
// Zero deps; safe in edge + node runtimes.

type Level = "debug" | "info" | "warn" | "error";

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const MIN = LEVELS[(process.env["LOG_LEVEL"] as Level) ?? "info"] ?? LEVELS.info;

function emit(level: Level, msg: string, fields?: Record<string, unknown>) {
  if (LEVELS[level] < MIN) return;
  const line = {
    level,
    msg,
    ts: new Date().toISOString(),
    ...fields,
  };
  // error/warn → stderr, rest → stdout
  const out = level === "error" || level === "warn" ? console.error : console.log;
  try {
    out(JSON.stringify(line));
  } catch {
    out(JSON.stringify({ level, msg, ts: line.ts, note: "unserializable fields" }));
  }
}

export const logger = {
  debug: (msg: string, fields?: Record<string, unknown>) => emit("debug", msg, fields),
  info: (msg: string, fields?: Record<string, unknown>) => emit("info", msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>) => emit("warn", msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => emit("error", msg, fields),
  /** Wrap an error object into loggable fields. */
  err: (e: unknown): Record<string, unknown> =>
    e instanceof Error ? { error: e.message, stack: e.stack } : { error: String(e) },
};
