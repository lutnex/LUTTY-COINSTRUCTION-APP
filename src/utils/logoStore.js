const LOGO_KEY = 'constructiq-company-logo'

/** Default branded fallback (SVG data URL — De-Luteroits red/navy). */
export function getDefaultLogoDataUrl() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
    <rect width="96" height="96" rx="12" fill="#B00020"/>
    <text x="48" y="58" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-size="28" font-weight="800" fill="#fff">DLC</text>
  </svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

export function getStoredLogo() {
  try {
    return localStorage.getItem(LOGO_KEY) || null
  } catch {
    return null
  }
}

export function saveLogo(dataUrl) {
  try {
    localStorage.setItem(LOGO_KEY, dataUrl)
    return true
  } catch (e) {
    console.error('[logoStore] save failed', e)
    return false
  }
}

export function clearStoredLogo() {
  try {
    localStorage.removeItem(LOGO_KEY)
  } catch { /* ignore */ }
}

/** Resolve logo for export: custom → default fallback. */
export function resolveLogoUrl() {
  return getStoredLogo() || getDefaultLogoDataUrl()
}

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp']

export function validateLogoFile(file) {
  if (!file) return { ok: false, error: 'No file selected' }
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return { ok: false, error: 'Use PNG, JPG, SVG, or WebP' }
  }
  if (file.size > 2 * 1024 * 1024) {
    return { ok: false, error: 'Logo must be under 2 MB' }
  }
  return { ok: true }
}

export function readLogoFile(file) {
  return new Promise((resolve, reject) => {
    const err = validateLogoFile(file)
    if (!err.ok) {
      reject(new Error(err.error))
      return
    }
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Failed to read logo file'))
    reader.readAsDataURL(file)
  })
}
