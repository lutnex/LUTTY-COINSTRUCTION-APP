/**
 * Render branded HTML documents to PDF via html2canvas + jsPDF.
 * Captures the full scrollable document (not viewport-only) with chunked rendering
 * when content exceeds browser canvas limits.
 */

const LOG_PREFIX = '[html-to-pdf]'

/** Max CSS pixels per capture slice at scale 2 (~8192px canvas height). */
const MAX_SLICE_CSS_PX = 3800
const RENDER_SCALE = 2
const A4_WIDTH_MM = 210
const A4_HEIGHT_MM = 297

let libsReady = false

function log(stage, detail) {
  console.log(`${LOG_PREFIX}[${stage}]`, detail ?? '')
}

function loadScript(src) {
  return new Promise((resolve) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve(true)
      return
    }
    const s = document.createElement('script')
    s.src = src
    s.onload = () => resolve(true)
    s.onerror = () => resolve(false)
    document.head.appendChild(s)
  })
}

export async function ensureHtmlToPdfLibs() {
  if (libsReady && window.jspdf && window.html2canvas) return true

  const jspdfOk = await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js')
  const h2cOk = await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js')

  libsReady = Boolean(jspdfOk && h2cOk && window.jspdf && window.html2canvas)
  if (!libsReady) log('load', 'html2canvas or jsPDF failed to load')
  return libsReady
}

function waitForImages(doc) {
  const images = [...doc.images]
  if (!images.length) return Promise.resolve()
  return Promise.all(images.map(img => {
    if (img.complete) return Promise.resolve()
    return new Promise(resolve => {
      img.onload = resolve
      img.onerror = resolve
    })
  }))
}

async function waitForDocumentReady(doc, root) {
  await waitForImages(doc)
  if (doc.fonts?.ready) {
    try {
      await doc.fonts.ready
    } catch {
      /* ignore font load errors */
    }
  }
  await new Promise(r => setTimeout(r, 150))
  await new Promise(r => {
    requestAnimationFrame(() => requestAnimationFrame(r))
  })
  if (root) {
    void root.offsetHeight
    void root.scrollHeight
  }
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 8000)
}

function html2canvasOpts(root, { y = 0, height, scale = RENDER_SCALE }) {
  const width = root.scrollWidth
  const sliceHeight = height ?? root.scrollHeight
  return {
    scale,
    useCORS: true,
    allowTaint: true,
    logging: false,
    backgroundColor: '#ffffff',
    width,
    height: sliceHeight,
    windowWidth: width,
    windowHeight: sliceHeight,
    scrollX: 0,
    scrollY: y,
    y,
    x: 0,
  }
}

/**
 * Capture the full document root in vertical slices to avoid canvas height truncation.
 */
async function captureDocumentCanvases(root, onProgress) {
  const totalHeight = root.scrollHeight
  const totalWidth = root.scrollWidth
  const expectedCanvasHeight = totalHeight * RENDER_SCALE

  log('render', {
    scrollWidth: totalWidth,
    scrollHeight: totalHeight,
    expectedCanvasHeight,
  })

  if (totalHeight <= MAX_SLICE_CSS_PX) {
    onProgress?.('Rendering PDF (single pass)…')
    const canvas = await window.html2canvas(root, html2canvasOpts(root, { y: 0, height: totalHeight }))
    const complete = canvas.height >= expectedCanvasHeight - 24
    log('render', { mode: 'single', canvasHeight: canvas.height, expectedCanvasHeight, complete })
    if (!complete) {
      log('render', 'Single capture truncated — switching to chunked capture')
    } else {
      return { canvases: [canvas], expectedCanvasHeight, capturedCanvasHeight: canvas.height }
    }
  }

  onProgress?.('Rendering PDF (multi-page capture)…')
  const canvases = []
  let y = 0
  let sliceIndex = 0

  while (y < totalHeight) {
    const sliceHeight = Math.min(MAX_SLICE_CSS_PX, totalHeight - y)
    onProgress?.(`Rendering PDF section ${sliceIndex + 1}…`)
    const canvas = await window.html2canvas(root, html2canvasOpts(root, { y, height: sliceHeight }))
    canvases.push(canvas)
    log('render', {
      mode: 'chunk',
      slice: sliceIndex + 1,
      y,
      sliceHeight,
      canvasHeight: canvas.height,
    })
    y += sliceHeight
    sliceIndex += 1
  }

  const capturedCanvasHeight = canvases.reduce((sum, c) => sum + c.height, 0)
  return { canvases, expectedCanvasHeight, capturedCanvasHeight }
}

/**
 * Append one or more canvas images to a jsPDF doc, splitting across A4 pages.
 */
function appendCanvasesToPdf(pdf, canvases) {
  let isFirstImage = pdf.internal.getNumberOfPages() === 1 && pdf.internal.pageSize.getHeight() === A4_HEIGHT_MM

  for (const canvas of canvases) {
    const imgWidth = A4_WIDTH_MM
    const imgHeight = (canvas.height * imgWidth) / canvas.width
    const imgData = canvas.toDataURL('image/jpeg', 0.92)

    let heightLeft = imgHeight
    let position = 0

    if (!isFirstImage) {
      pdf.addPage()
    }
    isFirstImage = false

    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight)
    heightLeft -= A4_HEIGHT_MM

    while (heightLeft > 0) {
      position = heightLeft - imgHeight
      pdf.addPage()
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight)
      heightLeft -= A4_HEIGHT_MM
    }
  }

  return pdf.internal.getNumberOfPages()
}

/**
 * Prepare iframe so the full document height is laid out (not clipped to viewport).
 */
function prepareIframeForCapture(iframe, doc, root) {
  const docWidth = root.scrollWidth || 794
  const docHeight = root.scrollHeight || 1123
  iframe.style.width = `${docWidth}px`
  iframe.style.height = `${docHeight + 40}px`
  iframe.style.overflow = 'visible'
  doc.documentElement.style.height = 'auto'
  doc.documentElement.style.overflow = 'visible'
  doc.body.style.height = 'auto'
  doc.body.style.overflow = 'visible'
  root.style.overflow = 'visible'
  root.style.minHeight = `${docHeight}px`
}

/**
 * Convert a full HTML document string to a downloaded PDF matching on-screen layout.
 * @returns {{ ok: boolean, method?: string, error?: string, pageCount?: number, capturedCanvasHeight?: number, expectedCanvasHeight?: number, exportedDataRows?: number }}
 */
export async function downloadHtmlAsPdf(html, filename, onProgress, { expectedDataRows } = {}) {
  onProgress?.('Preparing document…')

  if (!await ensureHtmlToPdfLibs()) {
    return { ok: false, error: 'PDF libraries unavailable' }
  }

  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;height:1200px;border:0;visibility:hidden;overflow:visible'
  document.body.appendChild(iframe)

  try {
    const doc = iframe.contentDocument
    doc.open()
    doc.write(html)
    doc.close()

    const root = doc.querySelector('.document')
    if (!root) throw new Error('Document root (.document) not found in HTML')

    prepareIframeForCapture(iframe, doc, root)
    await waitForDocumentReady(doc, root)
    prepareIframeForCapture(iframe, doc, root)
    await waitForDocumentReady(doc, root)

    const exportedDataRows = countHtmlDataRows(doc)

    onProgress?.('Rendering PDF…')
    const { canvases, expectedCanvasHeight, capturedCanvasHeight } = await captureDocumentCanvases(root, onProgress)

    const captureRatio = expectedCanvasHeight > 0 ? capturedCanvasHeight / expectedCanvasHeight : 1
    const captureComplete = captureRatio >= 0.98

    log('render', {
      expectedCanvasHeight,
      capturedCanvasHeight,
      captureRatio: captureRatio.toFixed(3),
      exportedDataRows,
      expectedDataRows,
    })

    if (!captureComplete) {
      return {
        ok: false,
        error: 'Document canvas capture was truncated',
        expectedCanvasHeight,
        capturedCanvasHeight,
        exportedDataRows,
      }
    }

    if (expectedDataRows != null && expectedDataRows > 0 && exportedDataRows < expectedDataRows) {
      return {
        ok: false,
        error: 'HTML row count below document state before capture',
        exportedDataRows,
        expectedDataRows,
      }
    }

    const { jsPDF } = window.jspdf
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageCount = appendCanvasesToPdf(pdf, canvases)

    onProgress?.('Saving PDF…')
    const bytes = pdf.output('arraybuffer')
    triggerDownload(new Blob([bytes], { type: 'application/pdf' }), filename)
    log('file-saving', { filename, bytes: bytes.byteLength, pageCount, exportedDataRows })
    return {
      ok: true,
      method: 'pdf',
      pageCount,
      exportedDataRows,
      expectedCanvasHeight,
      capturedCanvasHeight,
    }
  } catch (e) {
    log('error', e?.message)
    return { ok: false, error: e instanceof Error ? e.message : 'PDF generation failed' }
  } finally {
    document.body.removeChild(iframe)
  }
}

function countHtmlDataRows(doc) {
  let dataRows = 0
  for (const tr of doc.querySelectorAll('table.data tbody tr')) {
    if (tr.classList.contains('section-row')) continue
    if (tr.classList.contains('subtotal-row') || tr.classList.contains('grand-row')) continue
    dataRows += 1
  }
  return dataRows
}

/** Exposed for tests — count data rows in an HTML string. */
export function countHtmlDataRowsFromString(html) {
  if (typeof DOMParser === 'undefined') return 0
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return countHtmlDataRows(doc)
}
