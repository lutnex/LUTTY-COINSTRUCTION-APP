import { checkOpenAIHealth } from '../../lib/aiProxy.js'

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const payload = await checkOpenAIHealth()
  res.setHeader('Cache-Control', 'no-store')
  return res.status(payload.ok ? 200 : 503).json(payload)
}
