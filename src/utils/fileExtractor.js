import { ENV } from '../config/env.js'
import { DRAWING_TAKEOFF_PROMPT } from '../services/boq/quantityStrategy.js'

const MAX_TEXT_CHARS = 24_000
const MAX_PDF_PAGES_TEXT = 30
const MAX_PDF_PAGES_VISION = 5
const MAX_VISION_EDGE = 1568
const MIN_USEFUL_TEXT = 60
const SUPPORTED_EXT = ['pdf', 'doc', 'docx', 'txt', 'csv', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp']

function logAttach(...args) {
  if (ENV.debug || import.meta.env.DEV) console.log('[Attach]', ...args)
}

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = () => reject(new Error('Failed to read file'))
    r.readAsDataURL(file)
  })
}

function readAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = () => reject(new Error('Failed to read file'))
    r.readAsArrayBuffer(file)
  })
}

function chunkText(text, max = MAX_TEXT_CHARS) {
  if (!text) return ''
  if (text.length <= max) return text
  return `${text.slice(0, max)}\n\n[… document truncated — ${text.length - max} more characters omitted for token limits]`
}

async function loadPdfJs() {
  const pdfjs = await import('pdfjs-dist')
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url,
    ).toString()
  }
  return pdfjs
}

async function renderPdfPageToImage(page, scale = 1.5) {
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  canvas.width = Math.min(viewport.width, MAX_VISION_EDGE)
  canvas.height = Math.min(viewport.height, MAX_VISION_EDGE)
  const renderScale = Math.min(MAX_VISION_EDGE / viewport.width, MAX_VISION_EDGE / viewport.height, 1)
  const vp = page.getViewport({ scale: scale * renderScale })
  canvas.width = vp.width
  canvas.height = vp.height
  await page.render({ canvasContext: ctx, viewport: vp }).promise
  const dataUrl = canvas.toDataURL('image/jpeg', 0.82)
  const b64 = dataUrl.split(',')[1]
  return { mime: 'image/jpeg', b64, width: vp.width, height: vp.height }
}

async function extractPdf(file) {
  const warnings = []
  const pdfjs = await loadPdfJs()
  const buffer = await readAsArrayBuffer(file)
  const doc = await pdfjs.getDocument({ data: buffer }).promise
  const pageCount = doc.numPages
  logAttach('PDF opened', file.name, 'pages:', pageCount)

  const textParts = []
  const pagesToRead = Math.min(pageCount, MAX_PDF_PAGES_TEXT)
  for (let i = 1; i <= pagesToRead; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const pageText = content.items.map(it => it.str).join(' ').replace(/\s+/g, ' ').trim()
    if (pageText) textParts.push(`--- Page ${i} ---\n${pageText}`)
  }
  let text = textParts.join('\n\n')
  const method = text.length >= MIN_USEFUL_TEXT ? 'pdf-text' : 'pdf-vision'

  const images = []
  if (text.length < MIN_USEFUL_TEXT || pageCount <= MAX_PDF_PAGES_VISION) {
    const visionPages = Math.min(pageCount, MAX_PDF_PAGES_VISION)
    for (let i = 1; i <= visionPages; i++) {
      try {
        const page = await doc.getPage(i)
        const img = await renderPdfPageToImage(page)
        images.push({ ...img, page: i, label: `PDF page ${i}` })
      } catch (e) {
        warnings.push(`Could not render page ${i}: ${e.message}`)
      }
    }
    logAttach('PDF vision pages rendered', images.length)
  }

  if (pageCount > MAX_PDF_PAGES_TEXT) {
    warnings.push(`Text extracted from first ${MAX_PDF_PAGES_TEXT} of ${pageCount} pages`)
  }

  return {
    kind: 'pdf',
    name: file.name,
    mime: 'application/pdf',
    text: chunkText(text),
    textLength: text.length,
    pageCount,
    images,
    extractionMethod: images.length && text.length < MIN_USEFUL_TEXT ? 'pdf-vision' : method,
    warnings,
  }
}

async function runOcrOnImage(b64, mime = 'image/jpeg') {
  logAttach('OCR starting…')
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('eng', 1, { logger: () => {} })
  try {
    const dataUrl = `data:${mime};base64,${b64}`
    const { data } = await worker.recognize(dataUrl)
    const text = (data?.text || '').trim()
    logAttach('OCR complete, chars:', text.length)
    return text
  } finally {
    await worker.terminate()
  }
}

async function extractImage(file) {
  const dataUrl = await readAsDataURL(file)
  const b64 = dataUrl.split(',')[1]
  const mime = file.type || 'image/jpeg'
  const images = [{ mime, b64, page: 1, label: file.name }]

  let text = ''
  let extractionMethod = 'vision'
  const warnings = []

  try {
    text = await runOcrOnImage(b64, mime)
    if (text.length >= MIN_USEFUL_TEXT) extractionMethod = 'ocr+vision'
    else warnings.push('OCR found little text — using vision analysis for dimensions and quantities')
  } catch (e) {
    warnings.push(`OCR unavailable (${e.message}) — using vision analysis only`)
    logAttach('OCR failed', e.message)
  }

  return {
    kind: 'image',
    name: file.name,
    mime,
    b64,
    text: chunkText(text),
    textLength: text.length,
    images,
    extractionMethod,
    warnings,
  }
}

async function extractDocx(file) {
  const ab = await readAsArrayBuffer(file)
  const mammoth = await import('mammoth')
  const { value } = await mammoth.extractRawText({ arrayBuffer: ab })
  const text = value || ''
  logAttach('DOCX extracted', file.name, 'chars:', text.length)
  if (!text.trim()) {
    return {
      kind: 'document',
      name: file.name,
      failed: true,
      error: 'DOCX appears empty or contains only images — try exporting as PDF or paste text manually',
      warnings: [],
    }
  }
  return {
    kind: 'document',
    name: file.name,
    mime: file.type,
    text: chunkText(text),
    textLength: text.length,
    extractionMethod: 'mammoth',
    warnings: [],
  }
}

async function extractPlainText(file) {
  const text = await file.text()
  logAttach('Text file loaded', file.name, 'chars:', text.length)
  if (!text.trim()) {
    return { kind: 'document', name: file.name, failed: true, error: 'File is empty', warnings: [] }
  }
  return {
    kind: 'document',
    name: file.name,
    text: chunkText(text),
    textLength: text.length,
    extractionMethod: 'plain',
    warnings: [],
  }
}

/**
 * Extract content from an uploaded file for AI analysis.
 * @returns {Promise<import('./fileExtractor.types').ExtractedFile>}
 */
export async function extractFileContent(file) {
  if (!file) throw new Error('No file provided')

  const name = file.name
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  logAttach('Processing upload:', name, file.type, `${(file.size / 1024).toFixed(1)} KB`)

  if (!SUPPORTED_EXT.includes(ext) && !file.type.startsWith('image/')) {
    return {
      kind: 'unknown',
      name,
      failed: true,
      error: `Unsupported file type ".${ext}". Supported: PDF, DOCX, TXT, CSV, and images (PNG, JPG, WEBP).`,
      warnings: [],
    }
  }

  if (file.size > 15 * 1024 * 1024) {
    return {
      kind: 'unknown',
      name,
      failed: true,
      error: 'File exceeds 15 MB limit. Split the document or export a smaller PDF.',
      warnings: [],
    }
  }

  try {
    if (file.type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(ext)) {
      return await extractImage(file)
    }
    if (ext === 'pdf' || file.type.includes('pdf')) {
      return await extractPdf(file)
    }
    if (ext === 'docx' || ext === 'doc') {
      return await extractDocx(file)
    }
    if (ext === 'txt' || ext === 'csv') {
      return await extractPlainText(file)
    }
    return { kind: 'unknown', name, failed: true, error: 'Unsupported file type', warnings: [] }
  } catch (e) {
    console.error('[Attach] extraction failed:', name, e)
    return {
      kind: 'unknown',
      name,
      failed: true,
      error: e?.message || 'Extraction failed',
      warnings: [],
    }
  }
}

/**
 * Build OpenAI message content (string or multimodal parts) from extraction + user prompt.
 * @param {{ boqMode?: boolean }} options
 */
export function buildMessageContent(extracted, userPrompt = '', options = {}) {
  const { boqMode = false } = options
  const drawingGuide = boqMode ? DRAWING_TAKEOFF_PROMPT : `Analyze this construction document. Extract dimensions, scope, and quantities visible.`
  if (!extracted || extracted.failed) {
    const err = extracted?.error || 'File could not be processed'
    logAttach('buildMessageContent: failed', err)
    return `${userPrompt || 'Analyze this file.'}\n\n[ATTACHMENT ERROR: ${err}]\n\nSupported: PDF, DOCX, TXT, CSV, PNG, JPG, WEBP (max 15 MB).`
  }

  const prompt = userPrompt?.trim() || (boqMode
    ? 'Generate a full-scope professional BOQ from this drawing/document using the master bill structure.'
    : 'Analyze this uploaded construction file. Extract all visible project details, dimensions, and quantities.')
  const warnings = extracted.warnings?.length
    ? `\n[Parser notes: ${extracted.warnings.join('; ')}]`
    : ''

  const textBlock = extracted.text?.trim()
    ? `\n\n[EXTRACTED DOCUMENT TEXT — ${extracted.name}${extracted.pageCount ? `, ${extracted.pageCount} pages` : ''}, method: ${extracted.extractionMethod}, ${extracted.textLength ?? extracted.text.length} chars]\n${extracted.text}`
    : ''

  const instruction = `${prompt}${warnings}${textBlock}\n\n${drawingGuide}`

  const visionImages = extracted.images?.filter(img => img.b64) ?? []
  if (visionImages.length > 0) {
    const parts = [{ type: 'text', text: instruction }]
    for (const img of visionImages) {
      parts.push({
        type: 'image_url',
        image_url: {
          url: `data:${img.mime || 'image/jpeg'};base64,${img.b64}`,
          detail: 'high',
        },
      })
    }
    logAttach('buildMessageContent: multimodal', {
      file: extracted.name,
      textLen: extracted.textLength ?? 0,
      images: visionImages.length,
      method: extracted.extractionMethod,
    })
    return parts
  }

  if (textBlock) {
    logAttach('buildMessageContent: text-only', extracted.name, extracted.textLength)
    return instruction
  }

  logAttach('buildMessageContent: no content extracted')
  return `${prompt}\n\n[ATTACHMENT WARNING: No readable text or images could be extracted from "${extracted.name}". Try a clearer PDF export or upload a PNG/JPG of the drawing.]`
}

/** Summarize extraction for UI toasts. */
export function describeExtraction(extracted) {
  if (extracted.failed) return { ok: false, title: 'Extraction failed', body: extracted.error }
  const parts = []
  if (extracted.textLength) parts.push(`${extracted.textLength.toLocaleString()} chars text`)
  if (extracted.images?.length) parts.push(`${extracted.images.length} page(s) for vision`)
  if (extracted.pageCount) parts.push(`${extracted.pageCount} PDF pages`)
  return {
    ok: true,
    title: `${extracted.name} ready`,
    body: parts.join(' · ') || extracted.extractionMethod || 'Ready for analysis',
  }
}
