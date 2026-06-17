import { createClient } from '@supabase/supabase-js'
import { documentToRow, rowToDocument } from './savedDocumentMapper.js'

export function resolveSupabaseEnv(env = process.env) {
  const url = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').trim()
  const key = (env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || '').trim()
  return { url, key }
}

export function isSupabaseServerConfigured(env = process.env) {
  const { url, key } = resolveSupabaseEnv(env)
  if (!url || !key) return false
  if (/your-project|placeholder|xxx|changeme/i.test(url + key)) return false
  return url.startsWith('https://') && key.length > 20
}

export function createSupabaseServerClient(env = process.env) {
  const { url, key } = resolveSupabaseEnv(env)
  if (!isSupabaseServerConfigured(env)) return null
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export function parseImportDocuments(body) {
  const parsed = typeof body === 'string' ? JSON.parse(body) : body
  const docs = Array.isArray(parsed)
    ? parsed
    : (Array.isArray(parsed?.documents) ? parsed.documents : null)
  if (!docs) {
    throw new Error('Invalid backup format. Expected a JSON array of saved documents.')
  }
  return docs.filter(doc => doc?.id && doc?.name)
}

function extractMissingTableName(message) {
  const match = /relation ["']?([\w.]+)["']? does not exist/i.exec(message)
    || /Could not find the table ['"]([\w.]+)['"]/i.exec(message)
  if (!match) return null
  const full = match[1]
  return full.includes('.') ? full.split('.').pop() : full
}

export function formatSupabaseError(error, contextTable = null) {
  if (!error) return 'Unknown Supabase error'
  const message = error.message || String(error)

  if (/fetch failed|ENOTFOUND|getaddrinfo/i.test(message)) {
    return 'Cannot reach Supabase. Check the project URL is correct and the project is not paused.'
  }
  if (/relation.*does not exist|schema cache|Could not find the table/i.test(message)) {
    const table = contextTable || extractMissingTableName(message) || 'saved_documents'
    return `Supabase table "${table}" not found — run supabase/schema.sql in the SQL editor.`
  }
  if (/jwt|invalid api key|apikey/i.test(message)) {
    return 'Invalid Supabase API key. Copy the anon/publishable key from Project Settings → API.'
  }
  if (/permission denied|row-level security|42501/i.test(message)) {
    const table = contextTable || extractMissingTableName(message) || 'saved_documents'
    return `Supabase permission denied. Check RLS policies on ${table}.`
  }
  if (/payload too large|413/i.test(message)) {
    return 'Document is too large for Supabase. Try importing a smaller backup.'
  }

  return message
}

export async function checkSupabaseServerHealth(env = process.env) {
  if (!isSupabaseServerConfigured(env)) {
    return {
      ok: false,
      configured: false,
      message: 'Supabase is not configured on the server',
      statusLabel: 'Local Save Only',
    }
  }

  const supabase = createSupabaseServerClient(env)
  if (!supabase) {
    return {
      ok: false,
      configured: false,
      message: 'Supabase client could not be initialized',
      statusLabel: 'Supabase Not Connected',
    }
  }

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
}

export async function fetchServerDocuments(env = process.env) {
  const supabase = createSupabaseServerClient(env)
  if (!supabase) return { docs: [], error: 'Supabase not initialized' }

  const { data, error } = await supabase
    .from('saved_documents')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) return { docs: [], error: formatSupabaseError(error) }
  return { docs: (data || []).map(rowToDocument).filter(Boolean), error: null }
}

export async function upsertServerDocument(doc, env = process.env) {
  const supabase = createSupabaseServerClient(env)
  if (!supabase) return { ok: false, error: 'Supabase not initialized' }

  const { error } = await supabase
    .from('saved_documents')
    .upsert(documentToRow(doc), { onConflict: 'id' })

  if (error) return { ok: false, error: formatSupabaseError(error) }
  return { ok: true, error: null }
}

export async function deleteServerDocument(id, env = process.env) {
  const supabase = createSupabaseServerClient(env)
  if (!supabase) return { ok: false, error: 'Supabase not initialized' }

  const { error } = await supabase.from('saved_documents').delete().eq('id', id)
  if (error) return { ok: false, error: formatSupabaseError(error) }
  return { ok: true, error: null }
}

export async function importDocumentsToSupabase(docs, env = process.env) {
  if (!isSupabaseServerConfigured(env)) {
    return {
      ok: false,
      imported: 0,
      skipped: 0,
      failed: 0,
      total: docs.length,
      errors: ['Supabase is not configured on the server'],
    }
  }

  const supabase = createSupabaseServerClient(env)
  if (!supabase) {
    return {
      ok: false,
      imported: 0,
      skipped: 0,
      failed: 0,
      total: docs.length,
      errors: ['Supabase client could not be initialized'],
    }
  }

  const { data: existingRows, error: fetchError } = await supabase
    .from('saved_documents')
    .select('id')

  if (fetchError) {
    return {
      ok: false,
      imported: 0,
      skipped: 0,
      failed: 0,
      total: docs.length,
      errors: [formatSupabaseError(fetchError)],
    }
  }

  const existingIds = new Set((existingRows || []).map(row => row.id))
  const toInsert = docs.filter(doc => !existingIds.has(doc.id))

  let imported = 0
  let skipped = docs.length - toInsert.length
  let failed = 0
  const errors = []

  for (const doc of toInsert) {
    const { error } = await supabase.from('saved_documents').insert(documentToRow(doc))
    if (error) {
      const duplicate = error.code === '23505' || /duplicate key|already exists/i.test(error.message)
      if (duplicate) {
        skipped++
        continue
      }
      failed++
      errors.push(`${doc.name}: ${formatSupabaseError(error)}`)
    } else {
      imported++
    }
  }

  return {
    ok: failed === 0,
    imported,
    skipped,
    failed,
    total: docs.length,
    errors,
  }
}
