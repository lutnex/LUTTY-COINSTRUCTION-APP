/**
 * Vercel serverless route: consolidated material market + price profiles API
 * Routes: /api/materials/{list|search}, /api/prices/{list|save} via vercel.json rewrites
 */

import { handleMaterialPricesRequest } from '../lib/api/materialPricesHandler.js'

export default async function handler(req, res) {
  const resource = req.query?.resource || 'materials'
  const action = req.query?.action || 'list'
  return handleMaterialPricesRequest(req, res, process.env, resource, action)
}
