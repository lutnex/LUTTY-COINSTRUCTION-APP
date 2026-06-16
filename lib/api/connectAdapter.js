/** Adapt Node connect middleware req/res for shared API handlers. */

export function adaptRequest(req) {
  const url = new URL(req.url || '/', 'http://localhost')
  const query = Object.fromEntries(url.searchParams.entries())
  return {
    method: req.method,
    url: req.url,
    headers: req.headers,
    query,
    body: req.body,
    on: req.on?.bind(req),
  }
}

export function adaptResponse(res) {
  if (!res.json) {
    res.json = (data) => {
      if (!res.headersSent && !res.getHeader('Content-Type')) {
        res.setHeader('Content-Type', 'application/json')
      }
      res.end(JSON.stringify(data))
      return res
    }
  }
  if (!res.status) {
    res.status = (code) => {
      res.statusCode = code
      return res
    }
  }
  return res
}

export function mountActionRoute(middlewares, pathPrefix, handler, getArgs) {
  middlewares.use(pathPrefix, async (req, res) => {
    const adaptedReq = adaptRequest(req)
    const adaptedRes = adaptResponse(res)
    const action = adaptedReq.url.replace(pathPrefix, '').split('?')[0].replace(/^\//, '') || 'list'
    const args = getArgs(action, adaptedReq)
    await handler(adaptedReq, adaptedRes, ...args)
  })
}
