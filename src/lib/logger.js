import { supabase } from './supabase'

function write(type, message, meta = {}) {
  const { page, action, details } = meta
  supabase.from('logs').insert({
    type,
    page:    page    ?? null,
    action:  action  ?? null,
    message: String(message),
    details: details ?? null,
  }).then(({ error }) => {
    if (error && import.meta.env.DEV) {
      console.warn('[logger] Failed to write log:', error.message)
    }
  })
}

export function logError(message, { page, action, err, details } = {}) {
  const serializedErr = err
    ? { message: err.message, name: err.name, stack: err.stack }
    : undefined
  write('error', message, {
    page,
    action,
    details: { ...(serializedErr && { error: serializedErr }), ...details },
  })
}

export function logEvent(message, meta = {}) { write('event', message, meta) }
export function logPerf(message, meta = {})  { write('perf',  message, meta) }
