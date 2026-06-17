/**
 * Render branded HTML documents to PDF via html2canvas + jsPDF.
 * No third-party watermarks (PDFCrowd etc.) — uses local browser rendering only.
 */

const LOG_PREFIX = '[html-to-pdf]'

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

/**
 * Convert a full HTML document string to a downloaded PDF matching on-screen layout.
 */
export async function downloadHtmlAsPdf(html, filename, onProgress) {
  onProgress?.('Preparing document…')

  if (!await ensureHtmlToPdfLibs()) {
    return { ok: false, error: 'PDF libraries unavailable' }
  }

  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText = 'position:fixed;left:-10000px;top:0;width:794px;border:0;visibility:hidden'
  document.body.appendChild(iframe)

  try {
    const doc = iframe.contentDocument
    doc.open()
    doc.write(html)
    doc.close()

    await waitForImages(doc)
    await new Promise(r => setTimeout(r, 120))

    const root = doc.querySelector('.document')
    if (!root) throw new Error('Document root (.document) not found in HTML')

    onProgress?.('Rendering PDF…')
    log('render', 'html2canvas capture')

    const canvas = await window.html2canvas(root, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: root.scrollWidth,
      height: root.scrollHeight,
      windowWidth: root.scrollWidth,
    })

    const { jsPDF } = window.jspdf
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageWidth = 210
    const pageHeight = 297
    const imgWidth = pageWidth
    const imgHeight = (canvas.height * imgWidth) / canvas.width

    let heightLeft = imgHeight
    let position = 0
    const imgData = canvas.toDataURL('image/jpeg', 0.92)

    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight)
    heightLeft -= pageHeight

    while (heightLeft > 0) {
      position = heightLeft - imgHeight
      pdf.addPage()
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
    }

    onProgress?.('Saving PDF…')
    const bytes = pdf.output('arraybuffer')
    triggerDownload(new Blob([bytes], { type: 'application/pdf' }), filename)
    log('file-saving', { filename, bytes: bytes.byteLength })
    return { ok: true, method: 'pdf' }
  } catch (e) {
    log('error', e?.message)
    return { ok: false, error: e instanceof Error ? e.message : 'PDF generation failed' }
  } finally {
    document.body.removeChild(iframe)
  }
}
