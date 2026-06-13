/**
 * One-time migration: upload local saved documents JSON to Supabase.
 *
 * Usage:
 *   node scripts/migrate-local-documents.mjs path/to/export.json
 */

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import {
  importDocumentsToSupabase,
  parseImportDocuments,
  isSupabaseServerConfigured,
} from '../lib/supabaseServer.js'

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

async function main() {
  const inputArg = process.argv[2]
  const inputPath = resolve(ROOT, inputArg || 'data/local-documents.json')
  const env = {
    ...loadEnvFile(resolve(ROOT, '.env')),
    ...process.env,
  }

  if (!isSupabaseServerConfigured(env)) {
    console.error('Missing Supabase config. Set SUPABASE_URL and SUPABASE_ANON_KEY (or VITE_SUPABASE_*) in .env')
    process.exit(1)
  }

  if (!existsSync(inputPath)) {
    console.error(`Document export not found: ${inputPath}`)
    process.exit(1)
  }

  const docs = parseImportDocuments(readFileSync(inputPath, 'utf8'))
  if (!docs.length) {
    console.log('No documents to migrate.')
    return
  }

  const result = await importDocumentsToSupabase(docs, env)
  console.log(`Imported: ${result.imported}, skipped: ${result.skipped}, failed: ${result.failed}`)
  if (result.errors.length) {
    for (const err of result.errors) console.error(err)
  }
  if (!result.ok) process.exit(1)
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
