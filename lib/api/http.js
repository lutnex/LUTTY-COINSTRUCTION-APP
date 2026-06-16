/** Shared HTTP helpers for Vercel API handlers. */

export function setNoStore(res) {
  res.setHeader('Cache-Control', 'no-store')
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export async function readJsonBody(req) {
  const body = req.body
  if (body != null && body !== '') {
    if (Buffer.isBuffer(body)) return JSON.parse(body.toString('utf8'))
    if (typeof body === 'string') return JSON.parse(body)
    if (typeof body === 'object') return body
  }
  const raw = await readRawBody(req)
  if (!raw.length) return null
  return JSON.parse(raw.toString('utf8'))
}

export async function readRawRequestBody(req) {
  const body = req.body
  if (body != null && body !== '') {
    if (Buffer.isBuffer(body)) return body
    if (typeof body === 'string') return Buffer.from(body)
    if (typeof body === 'object') return Buffer.from(JSON.stringify(body))
  }
  const raw = await readRawBody(req)
  return raw.length ? raw : null
}
