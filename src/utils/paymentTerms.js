/**
 * Payment terms — user-controlled, per-estimate, with optional saved defaults.
 */

export const STORAGE_KEY_PAYMENT_TERMS_DEFAULT = 'constructiq-payment-terms-default'

export const TEMPLATE_PAYMENT_TERMS = [
  'Material funds shall be made available before commencement.',
  '70% mobilization payment is required before work starts.',
  'Remaining balance payable upon completion.',
  'Bank details will be provided upon request.',
]

export function createPaymentTermsFromTexts(texts = []) {
  const base = Date.now()
  return texts.map((text, i) => ({
    id: base + i,
    html: String(text || ''),
  }))
}

export function createTemplatePaymentTerms() {
  return createPaymentTermsFromTexts(TEMPLATE_PAYMENT_TERMS)
}

export function loadUserPaymentTermsDefault() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PAYMENT_TERMS_DEFAULT)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const items = normalizePaymentTerms(parsed)
    return items.length ? items : null
  } catch {
    return null
  }
}

export function persistUserPaymentTermsDefault(items) {
  try {
    localStorage.setItem(STORAGE_KEY_PAYMENT_TERMS_DEFAULT, JSON.stringify(items))
    return true
  } catch {
    return false
  }
}

export function resolveInitialPaymentTerms(metaPaymentTerms) {
  if (metaPaymentTerms != null) return normalizePaymentTerms(metaPaymentTerms)
  return loadUserPaymentTermsDefault() || createTemplatePaymentTerms()
}

/** Normalize legacy string or array shapes into [{ id, html }]. */
export function normalizePaymentTerms(input) {
  if (!input) return []
  if (typeof input === 'string') {
    const lines = input.split('\n').map(l => l.replace(/^[\s•\-*]+/, '').trim()).filter(Boolean)
    return createPaymentTermsFromTexts(lines)
  }
  if (!Array.isArray(input)) return []
  return input.map((item, i) => {
    if (typeof item === 'string') {
      return { id: Date.now() + i, html: item }
    }
    return {
      id: item.id ?? Date.now() + i,
      html: String(item.html ?? item.text ?? item.content ?? ''),
    }
  })
}

export function stripHtml(html) {
  return String(html ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim()
}

export function sanitizePaymentHtml(html) {
  return String(html ?? '')
    .replace(/<(?!\/?(strong|em|b|i)\b)[^>]+>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
}

export function paymentTermsToPlainText(items) {
  const normalized = normalizePaymentTerms(items)
  if (!normalized.length) return ''
  return normalized
    .map(item => {
      const text = stripHtml(item.html).trim()
      return text ? `• ${text}` : ''
    })
    .filter(Boolean)
    .join('\n')
}

export function paymentTermsToHtml(items) {
  const normalized = normalizePaymentTerms(items)
  if (!normalized.length) return ''
  const lis = normalized
    .map(item => {
      const raw = sanitizePaymentHtml(item.html || '')
      const text = stripHtml(raw).trim()
      if (!text) return ''
      return `<li>${raw || text}</li>`
    })
    .filter(Boolean)
    .join('')
  return lis ? `<ul>${lis}</ul>` : ''
}

export function hasPaymentTerms(items) {
  return normalizePaymentTerms(items).some(item => stripHtml(item.html).trim())
}
