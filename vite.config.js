import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import {
  OPENAI_TARGET,
  isValidApiKey,
  getMissingKeyError,
  resolveApiKey,
  proxyChatToOpenAI,
  checkOpenAIHealth,
} from './lib/aiProxy.js'
import {
  importDocumentsToSupabase,
  parseImportDocuments,
  isSupabaseServerConfigured,
  checkSupabaseServerHealth,
  fetchServerDocuments,
  upsertServerDocument,
  deleteServerDocument,
} from './lib/supabaseServer.js'
import {
  searchAllMaterialPrices,
  fetchCachedMaterialPrices,
} from './lib/materialPriceSearch.js'
import {
  fetchPriceProfilesFromCloud,
  upsertPriceProfilesToCloud,
} from './lib/priceProfileServer.js'

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function attachAIHandlers(middlewares, env) {
  const apiKey = resolveApiKey(env)

  const handleHealth = async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.statusCode = 405
      res.end()
      return
    }
    const health = await checkOpenAIHealth(env)
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Cache-Control', 'no-store')
    res.statusCode = health.ok ? 200 : 503
    res.end(JSON.stringify(health))
  }

  const handleProxy = async (req, res) => {
    if (req.method === 'GET' || req.method === 'HEAD') {
      await handleHealth(req, res)
      return
    }
    if (req.method !== 'POST') {
      res.statusCode = 405
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: { message: 'Method not allowed' } }))
      return
    }
    if (!isValidApiKey(apiKey)) {
      res.statusCode = 503
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(getMissingKeyError(apiKey)))
      return
    }
    await proxyChatToOpenAI(req, res, apiKey)
  }

  // Primary production endpoint (matches VITE_AI_ENDPOINT=/api/ai-proxy)
  middlewares.use('/api/ai-proxy', handleProxy)

  // Legacy routes (backward compatibility)
  middlewares.use('/api/ai/health', handleHealth)

  middlewares.use('/api/ai', async (req, res) => {
    if (req.method !== 'POST' && req.method !== 'GET' && req.method !== 'HEAD') {
      res.statusCode = 405
      res.end()
      return
    }

    if (!isValidApiKey(apiKey)) {
      res.statusCode = 503
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(getMissingKeyError(apiKey)))
      return
    }

    const subPath = req.url || '/v1/chat/completions'
    const targetUrl = `${OPENAI_TARGET}${subPath.startsWith('/') ? subPath : `/${subPath}`}`

    try {
      const body = req.method === 'POST' ? await readRequestBody(req) : undefined

      const upstream = await fetch(targetUrl, {
        method: req.method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          ...(req.headers.accept ? { Accept: req.headers.accept } : {}),
        },
        body: body?.length ? body : undefined,
      })

      res.statusCode = upstream.status
      res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json')

      if (upstream.body) {
        const reader = upstream.body.getReader()
        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          res.write(Buffer.from(value))
        }
      }
      res.end()
    } catch (err) {
      console.error('OPENAI PROXY ERROR:', err)
      if (!res.headersSent) {
        res.statusCode = 502
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({
          error: {
            message: err instanceof Error ? err.message : 'OpenAI proxy request failed',
          },
        }))
      } else {
        res.end()
      }
    }
  })

  middlewares.use('/api/materials/list', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.statusCode = 405
      res.end(JSON.stringify({ ok: false, prices: [], error: 'Method not allowed' }))
      return
    }
    const { prices, error } = await fetchCachedMaterialPrices(env)
    res.statusCode = error ? 502 : 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ ok: !error, prices, error }))
  })

  middlewares.use('/api/materials/search', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'POST') {
      res.statusCode = 405
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ ok: false, errors: ['Method not allowed'] }))
      return
    }
    try {
      const raw = await readRequestBody(req)
      const body = raw.length ? JSON.parse(raw.toString('utf8')) : { refresh: true }
      const result = await searchAllMaterialPrices({ refresh: body.refresh !== false }, env)
      res.statusCode = result.ok ? 200 : 207
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(result))
    } catch (err) {
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ ok: false, errors: [err instanceof Error ? err.message : 'Search failed'] }))
    }
  })

  middlewares.use('/api/prices/list', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.statusCode = 405
      res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }))
      return
    }
    const result = await fetchPriceProfilesFromCloud(env)
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ ok: Boolean(result.state), state: result.state, error: result.error }))
  })

  middlewares.use('/api/prices/save', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'POST') {
      res.statusCode = 405
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }))
      return
    }
    try {
      const raw = await readRequestBody(req)
      const body = raw.length ? JSON.parse(raw.toString('utf8')) : {}
      const result = await upsertPriceProfilesToCloud(body.state, env)
      res.statusCode = result.ok ? 200 : 500
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(result))
    } catch (err) {
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : 'Save failed' }))
    }
  })

  middlewares.use('/api/documents/health', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.statusCode = 405
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ ok: false, message: 'Method not allowed' }))
      return
    }
    if (!isSupabaseServerConfigured(env)) {
      res.statusCode = 503
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({
        ok: false,
        configured: false,
        message: 'Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY in .env',
        statusLabel: 'Local Save Only',
      }))
      return
    }
    const result = await checkSupabaseServerHealth(env)
    res.statusCode = result.ok ? 200 : 502
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(result))
  })

  middlewares.use('/api/documents/list', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.statusCode = 405
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ docs: [], error: 'Method not allowed' }))
      return
    }
    if (!isSupabaseServerConfigured(env)) {
      res.statusCode = 503
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ docs: [], error: 'Supabase is not configured' }))
      return
    }
    const { docs, error } = await fetchServerDocuments(env)
    res.statusCode = error ? 502 : 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ docs, error }))
  })

  middlewares.use('/api/documents/save', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'POST') {
      res.statusCode = 405
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }))
      return
    }
    if (!isSupabaseServerConfigured(env)) {
      res.statusCode = 503
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ ok: false, error: 'Supabase is not configured' }))
      return
    }
    try {
      const raw = await readRequestBody(req)
      const doc = raw.length ? JSON.parse(raw.toString('utf8')) : null
      if (!doc?.id || !doc?.name) {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: false, error: 'Invalid document payload' }))
        return
      }
      const result = await upsertServerDocument(doc, env)
      res.statusCode = result.ok ? 200 : 502
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(result))
    } catch (err) {
      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : 'Save failed' }))
    }
  })

  middlewares.use('/api/documents/delete', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'POST' && req.method !== 'DELETE') {
      res.statusCode = 405
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }))
      return
    }
    if (!isSupabaseServerConfigured(env)) {
      res.statusCode = 503
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ ok: false, error: 'Supabase is not configured' }))
      return
    }
    const url = new URL(req.url, 'http://localhost')
    const id = url.searchParams.get('id')
    if (!id) {
      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ ok: false, error: 'Document id is required' }))
      return
    }
    const result = await deleteServerDocument(id, env)
    res.statusCode = result.ok ? 200 : 502
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(result))
  })

  middlewares.use('/api/documents/import', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')

    if (req.method !== 'POST') {
      res.statusCode = 405
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ ok: false, errors: ['Method not allowed'] }))
      return
    }

    if (!isSupabaseServerConfigured(env)) {
      res.statusCode = 503
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({
        ok: false,
        errors: ['Supabase is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY in .env'],
      }))
      return
    }

    try {
      const raw = await readRequestBody(req)
      const payload = raw.length ? JSON.parse(raw.toString('utf8')) : null
      const docs = parseImportDocuments(payload)

      if (!docs.length) {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: false, errors: ['No valid documents found in backup file'] }))
        return
      }

      const result = await importDocumentsToSupabase(docs, env)
      res.statusCode = result.ok ? 200 : 502
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(result))
    } catch (err) {
      console.error('[dev/api/documents/import] failed:', err)
      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({
        ok: false,
        errors: [err instanceof Error ? err.message : 'Import failed'],
      }))
    }
  })

  // Variation Orders API
  middlewares.use('/api/variations/list', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.statusCode = 405
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ orders: [], error: 'Method not allowed' }))
      return
    }
    if (!isSupabaseServerConfigured(env)) {
      res.statusCode = 503
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ orders: [], error: 'Supabase is not configured' }))
      return
    }
    const { fetchServerVariationOrders } = await import('./lib/variationOrderServer.js')
    const { orders, error } = await fetchServerVariationOrders(env)
    res.statusCode = error ? 502 : 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ orders, error }))
  })

  middlewares.use('/api/variations/save', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'POST') {
      res.statusCode = 405
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }))
      return
    }
    if (!isSupabaseServerConfigured(env)) {
      res.statusCode = 503
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ ok: false, error: 'Supabase is not configured' }))
      return
    }
    try {
      const raw = await readRequestBody(req)
      const vo = raw.length ? JSON.parse(raw.toString('utf8')) : null
      if (!vo?.id || !vo?.variationNumber) {
        res.statusCode = 400
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ ok: false, error: 'Invalid variation order payload' }))
        return
      }
      const { upsertServerVariationOrder } = await import('./lib/variationOrderServer.js')
      const result = await upsertServerVariationOrder(vo, env)
      res.statusCode = result.ok ? 200 : 502
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(result))
    } catch (err) {
      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : 'Save failed' }))
    }
  })

  middlewares.use('/api/variations/delete', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'POST' && req.method !== 'DELETE') {
      res.statusCode = 405
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }))
      return
    }
    if (!isSupabaseServerConfigured(env)) {
      res.statusCode = 503
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ ok: false, error: 'Supabase is not configured' }))
      return
    }
    const url = new URL(req.url, 'http://localhost')
    const id = url.searchParams.get('id')
    if (!id) {
      res.statusCode = 400
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ ok: false, error: 'Variation order id is required' }))
      return
    }
    const { deleteServerVariationOrder } = await import('./lib/variationOrderServer.js')
    const result = await deleteServerVariationOrder(id, env)
    res.statusCode = result.ok ? 200 : 502
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(result))
  })
}

function aiProxyPlugin(mode, envDir) {
  return {
    name: 'constructiq-openai-proxy',
    configureServer(server) {
      attachAIHandlers(server.middlewares, loadEnv(mode, envDir, ''))
    },
    configurePreviewServer(server) {
      attachAIHandlers(server.middlewares, loadEnv(mode, envDir, ''))
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), aiProxyPlugin(mode, process.cwd())],
  server: { port: 5173, open: true },
  preview: { port: 4173 },
}))
