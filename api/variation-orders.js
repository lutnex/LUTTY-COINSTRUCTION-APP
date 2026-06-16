/**
 * Vercel serverless route: consolidated variation orders API
 * Routes: /api/variations/{list|save|delete} via vercel.json rewrite
 */

import { handleVariationOrdersRequest } from '../lib/api/variationOrdersHandler.js'

export default async function handler(req, res) {
  const action = req.query?.action || 'list'
  return handleVariationOrdersRequest(req, res, process.env, action)
}
