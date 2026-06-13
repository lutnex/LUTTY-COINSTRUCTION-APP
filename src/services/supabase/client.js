import { createClient } from '@supabase/supabase-js'
import { ENV, isSupabaseConfigured } from '../../config/env.js'
import { formatSupabaseError } from '../../../lib/supabaseServer.js'

let client = null
let clientUrl = ''
let clientKey = ''

export function getSupabaseClient() {
  if (!isSupabaseConfigured()) return null

  const url = ENV.supabaseUrl.trim()
  const key = ENV.supabaseAnonKey.trim()

  if (!client || clientUrl !== url || clientKey !== key) {
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    clientUrl = url
    clientKey = key
  }

  return client
}

export async function checkSupabaseConnection() {
  try {
    const response = await fetch('/api/documents/health', { cache: 'no-store' })
    const data = await response.json().catch(() => null)
    if (response.ok && data) {
      return {
        ok: Boolean(data.ok),
        configured: Boolean(data.configured),
        message: data.message || (data.ok ? 'Cloud storage connected' : 'Connection failed'),
        statusLabel: data.statusLabel || (data.ok ? 'Cloud Save Active' : 'Supabase Not Connected'),
      }
    }
    if (response.status !== 404 && data?.message) {
      return {
        ok: false,
        configured: Boolean(data.configured),
        message: data.message,
        statusLabel: data.statusLabel || 'Supabase Not Connected',
      }
    }
  } catch {
    // fall through to direct client check
  }

  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      configured: false,
      message: 'Supabase environment variables are not set',
      statusLabel: 'Local Save Only',
    }
  }

  const supabase = getSupabaseClient()
  if (!supabase) {
    return {
      ok: false,
      configured: false,
      message: 'Supabase client could not be initialized',
      statusLabel: 'Supabase Not Connected',
    }
  }

  try {
    const { error } = await supabase.from('saved_documents').select('id').limit(1)
    if (error) {
      const missingTable = /relation.*does not exist|schema cache/i.test(error.message)
      return {
        ok: false,
        configured: true,
        message: missingTable
          ? 'Supabase table "saved_documents" not found — run supabase/schema.sql'
          : formatSupabaseError(error),
        statusLabel: 'Supabase Not Connected',
      }
    }
    return {
      ok: true,
      configured: true,
      message: 'Cloud storage connected',
      statusLabel: 'Cloud Save Active',
    }
  } catch (err) {
    return {
      ok: false,
      configured: true,
      message: err instanceof Error ? err.message : 'Connection failed',
      statusLabel: 'Supabase Not Connected',
    }
  }
}
