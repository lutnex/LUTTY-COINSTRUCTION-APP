/** Structured debug logging for session / workflow stability. */

const PREFIX = '[Session]'

export function logSessionDebug(event, detail = {}) {
  const payload = { event, at: new Date().toISOString(), ...detail }
  console.log(PREFIX, payload)
  return payload
}

export function logErrorBoundary(error, info) {
  console.error('[ErrorBoundary]', {
    message: error?.message,
    stack: error?.stack,
    componentStack: info?.componentStack,
    at: new Date().toISOString(),
  })
}

export function logWorkflowMissing(actionId, reason) {
  console.warn('[WorkflowAction] missing-data', { actionId, reason, at: new Date().toISOString() })
}
