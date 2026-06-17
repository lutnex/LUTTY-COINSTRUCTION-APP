/**
 * Vercel serverless route: revised documents API
 * Routes: /api/revised/{list|save|delete} via vercel.json rewrite
 */

import { handleRevisedDocumentsRequest } from '../lib/api/revisedDocumentsHandler.js'

export default async function handler(req, res) {
  const action = req.query?.action || 'list'
  return handleRevisedDocumentsRequest(req, res, process.env, action)
}
