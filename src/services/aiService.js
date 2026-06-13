/** Central AI service facade — prefer importing from here or `services/ai/client.js`. */
export { callAI, callAISync, checkAIHealth, buildOpenAIMessages, toOpenAIContent } from './ai/client.js'
export { formatApiError, toUserFacingError, isRetryableStatus, isRetryableError } from './ai/errors.js'
export { estimateTokenCost, recordUsage, loadUsageStats, formatCostUsd } from './ai/usage.js'
export { getRetryDelayMs, createRequestGuard, linkAbortSignals } from './ai/request.js'
export {
  resolvePromptMode,
  getSystemPromptForMode,
  augmentBOQUserPrompt,
  shouldUseBOQEngine,
} from './boq/boqEngine.js'
export { parseAIResponse } from './ai/responseParser.js'
