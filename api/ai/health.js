import { resolveApiKey, getHealthPayload } from '../../lib/aiProxy.js'

export default function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const payload = getHealthPayload(resolveApiKey())
  res.setHeader('Cache-Control', 'no-store')
  res.status(payload.ok ? 200 : 503).json(payload)
}
