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
import { handleDocumentsRequest } from './lib/api/documentsHandler.js'
import { handleMaterialPricesRequest } from './lib/api/materialPricesHandler.js'
import { handleVariationOrdersRequest } from './lib/api/variationOrdersHandler.js'
import { handleRevisedDocumentsRequest } from './lib/api/revisedDocumentsHandler.js'
import { adaptRequest, adaptResponse } from './lib/api/connectAdapter.js'

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

  middlewares.use('/api/ai-proxy', handleProxy)
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
          error: { message: err instanceof Error ? err.message : 'OpenAI proxy request failed' },
        }))
      } else {
        res.end()
      }
    }
  })

  const docActions = ['health', 'list', 'save', 'delete', 'import']
  for (const action of docActions) {
    middlewares.use(`/api/documents/${action}`, async (req, res) => {
      await handleDocumentsRequest(adaptRequest(req), adaptResponse(res), env, action)
    })
  }

  const materialActions = ['list', 'search']
  for (const action of materialActions) {
    middlewares.use(`/api/materials/${action}`, async (req, res) => {
      await handleMaterialPricesRequest(adaptRequest(req), adaptResponse(res), env, 'materials', action)
    })
  }

  const priceActions = ['list', 'save']
  for (const action of priceActions) {
    middlewares.use(`/api/prices/${action}`, async (req, res) => {
      await handleMaterialPricesRequest(adaptRequest(req), adaptResponse(res), env, 'prices', action)
    })
  }

  const variationActions = ['list', 'save', 'delete']
  for (const action of variationActions) {
    middlewares.use(`/api/variations/${action}`, async (req, res) => {
      await handleVariationOrdersRequest(adaptRequest(req), adaptResponse(res), env, action)
    })
  }

  const revisedActions = ['list', 'save', 'delete']
  for (const action of revisedActions) {
    middlewares.use(`/api/revised/${action}`, async (req, res) => {
      await handleRevisedDocumentsRequest(adaptRequest(req), adaptResponse(res), env, action)
    })
  }
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
  define: {
    __APP_BUILD_ID__: JSON.stringify(
      process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7)
      || process.env.GITHUB_SHA?.slice(0, 7)
      || 'local',
    ),
  },
  server: { port: 5173, open: true },
  preview: { port: 4173 },
}))
