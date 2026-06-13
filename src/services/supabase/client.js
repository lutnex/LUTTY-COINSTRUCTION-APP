import { createClient } from '@supabase/supabase-js'
import { ENV, isSupabaseConfigured } from '../../config/env.js'
import { formatSupabaseError } from '../../../lib/supabaseServer.js'

let client = null

export function getSupabaseClient() {
  if (!isSupabaseConfigured()) return null
  if (!client) {
    client = createClient(ENV.supabaseUrl.trim(), ENV.supabaseAnonKey.trim(), {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return client
}

export async function checkSupabaseConnection() {
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
