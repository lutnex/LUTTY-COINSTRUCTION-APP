/**
 * Vercel serverless route: consolidated saved documents API
 * Routes: /api/documents/{health|list|save|delete|import} via vercel.json rewrite
 */

import { handleDocumentsRequest } from '../lib/api/documentsHandler.js'

export default async function handler(req, res) {
  const action = req.query?.action || 'health'
  return handleDocumentsRequest(req, res, process.env, action)
}
