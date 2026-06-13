import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const OPENAI_TARGET = 'https://api.openai.com'

function isValidApiKey(key) {
  if (!key || typeof key !== 'string') return false
  const k = key.trim()
  if (k.length < 20) return false
  if (/your-key|placeholder|xxx|changeme/i.test(k)) return false
  return k.startsWith('sk-proj-') || k.startsWith('sk-')
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function attachAIHandlers(middlewares, env) {
  const apiKey = env.OPENAI_API_KEY || env.VITE_OPENAI_API_KEY || ''

  middlewares.use('/api/ai/health', (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.statusCode = 405
      res.end()
      return
    }
    const ok = isValidApiKey(apiKey)
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({
      ok,
      mode: 'openai-proxy',
      message: ok
        ? 'OpenAI API key configured'
        : apiKey
          ? 'OPENAI_API_KEY looks like a placeholder — replace with your real key'
          : 'OPENAI_API_KEY is missing — copy .env.example to .env',
    }))
  })

  middlewares.use('/api/ai', async (req, res) => {
    if (req.method !== 'POST' && req.method !== 'GET' && req.method !== 'HEAD') {
      res.statusCode = 405
      res.end()
      return
    }

    if (!isValidApiKey(apiKey)) {
      res.statusCode = 503
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({
        error: {
          message: apiKey
            ? 'OPENAI_API_KEY is a placeholder. Add your real key to .env and restart.'
            : 'OPENAI_API_KEY is not set. Copy .env.example to .env and restart.',
        },
      }))
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
