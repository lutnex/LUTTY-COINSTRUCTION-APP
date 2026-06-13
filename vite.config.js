import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import {
  OPENAI_TARGET,
  isValidApiKey,
  getMissingKeyError,
  resolveApiKey,
  proxyChatToOpenAI,
} from './lib/aiProxy.js'

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

  const handleHealth = (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.statusCode = 405
      res.end()
      return
    }
    res.setHeader('Content-Type', 'application/json')
    res.statusCode = 200
    res.end(JSON.stringify({ ok: true, status: 'AI proxy active' }))
  }

  const handleProxy = async (req, res) => {
    if (req.method === 'GET' || req.method === 'HEAD') {
      handleHealth(req, res)
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
    const serverKey = env.OPENAI_API_KEY || apiKey
    await proxyChatToOpenAI(req, res, serverKey)
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
