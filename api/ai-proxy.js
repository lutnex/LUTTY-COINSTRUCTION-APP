import {
  resolveApiKey,
  isValidApiKey,
  getHealthPayload,
  getMissingKeyError,
  proxyChatToOpenAI,
} from '../lib/aiProxy.js'

export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
}

export default async function handler(req, res) {
  if (req.method === 'GET' || req.method === 'HEAD') {
    const payload = getHealthPayload(resolveApiKey())
    res.setHeader('Cache-Control', 'no-store')
    res.status(payload.ok ? 200 : 503).json(payload)
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: { message: 'Method not allowed' } })
    return
  }

  const apiKey = resolveApiKey()
  if (!isValidApiKey(apiKey)) {
    res.status(503).json(getMissingKeyError(apiKey))
    return
  }

  await proxyChatToOpenAI(req, res, apiKey)
}
