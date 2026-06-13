/**
 * One-time migration: upload local saved documents JSON to Supabase.
 *
 * Usage:
 *   1. Export from browser DevTools:
 *        copy(localStorage.getItem('constructiq-saved-documents'))
 *      Save output to data/local-documents.json
 *   2. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env
 *   3. Run: npm run migrate:documents
 *      Or:  node scripts/migrate-local-documents.mjs path/to/export.json
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'
import { documentToRow } from '../lib/savedDocumentMapper.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

function loadEnvFile(path) {
  if (!existsSync(path)) return {}
  const vars = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    vars[key] = value
  }
  return vars
}

function loadDocuments(inputPath) {
  const raw = readFileSync(inputPath, 'utf8')
  const parsed = JSON.parse(raw)
  if (Array.isArray(parsed)) return parsed
  if (Array.isArray(parsed.documents)) return parsed.documents
  throw new Error('Expected a JSON array of documents or { documents: [...] }')
}

function isConfigured(url, key) {
  if (!url || !key) return false
  if (/your-project|placeholder|xxx|changeme/i.test(url + key)) return false
  return url.startsWith('https://') && key.length > 20
}

async function main() {
  const inputArg = process.argv[2]
  const inputPath = resolve(ROOT, inputArg || 'data/local-documents.json')
  const env = {
    ...loadEnvFile(resolve(ROOT, '.env')),
    ...process.env,
  }

  const url = env.VITE_SUPABASE_URL?.trim()
  const key = env.VITE_SUPABASE_ANON_KEY?.trim()

  if (!isConfigured(url, key)) {
    console.error('Missing Supabase config. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env')
    process.exit(1)
  }

  if (!existsSync(inputPath)) {
    console.error(`Document export not found: ${inputPath}`)
    console.error('Export from browser: copy(localStorage.getItem("constructiq-saved-documents"))')
    console.error('Save the result to data/local-documents.json, then re-run.')
    process.exit(1)
  }

  const docs = loadDocuments(inputPath)
  if (!docs.length) {
    console.log('No documents to migrate.')
    return
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { error: pingError } = await supabase.from('saved_documents').select('id').limit(1)
  if (pingError) {
    console.error('Supabase error:', pingError.message)
    if (/relation.*does not exist|schema cache/i.test(pingError.message)) {
      console.error('Run supabase/schema.sql in your Supabase SQL editor first.')
    }
    process.exit(1)
  }

  const { data: existingRows, error: fetchError } = await supabase
    .from('saved_documents')
    .select('id')
  if (fetchError) {
    console.error('Could not read existing documents:', fetchError.message)
    process.exit(1)
  }

  const existingIds = new Set((existingRows || []).map(row => row.id))
  const toInsert = docs.filter(doc => !existingIds.has(doc.id))
  const skipped = docs.length - toInsert.length

  let imported = 0
  let failed = 0

  for (const doc of toInsert) {
    if (!doc?.id || !doc?.name) {
      console.warn('Skipping invalid document entry:', doc)
      failed++
      continue
    }

    const { error } = await supabase.from('saved_documents').insert(documentToRow(doc))

    if (error) {
      const duplicate = error.code === '23505' || /duplicate key|already exists/i.test(error.message)
      if (duplicate) {
        console.log(`Skipped (already exists): ${doc.name}`)
        continue
      }
      console.error(`Failed: ${doc.name} (${doc.id}) — ${error.message}`)
      failed++
    } else {
      console.log(`Imported: ${doc.name}`)
      imported++
    }
  }

  const { count, error: countError } = await supabase
    .from('saved_documents')
    .select('id', { count: 'exact', head: true })
  if (!countError) {
    console.log(`\nSupabase now has ${count ?? '?'} saved document(s).`)
  }

  console.log(`\nDone. ${imported} imported, ${skipped} skipped, ${failed} failed, ${docs.length} total in backup.`)
  if (failed > 0) process.exit(1)
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
