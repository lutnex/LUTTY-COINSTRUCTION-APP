// src/services/pdfService.js — PDF generation via jsPDF CDN + HTML fallback

import { COMPANY } from '../utils/constants.js'

const PDF_NAVY  = [10, 42, 67]
const PDF_RED   = [176, 0, 32]
const PDF_GOLD  = [252, 211, 77]
const PDF_LIGHT = [247, 249, 252]
const PDF_DARK  = [26, 26, 46]
const PDF_GREY  = [208, 216, 232]

const DOC_TITLES = {
  estimate:     'CONSTRUCTION ESTIMATE',
  quotation:    'PROJECT QUOTATION',
  boq:          'BILL OF QUANTITIES',
  invoice:      'PROFORMA INVOICE',
  payment_cert: 'PAYMENT CERTIFICATE',
}

let jsPDFReady = false

async function ensureJsPDF() {
  if (jsPDFReady) return true
  if (window.jspdf) { jsPDFReady = true; return true }

  return new Promise(resolve => {
    const s1 = document.createElement('script')
    s1.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
    s1.onload = () => {
      const s2 = document.createElement('script')
      s2.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js'
      s2.onload = () => { jsPDFReady = true; resolve(true) }
      s2.onerror = () => resolve(false)
      document.head.appendChild(s2)
    }
    s1.onerror = () => resolve(false)
    document.head.appendChild(s1)
  })
}

function fmtN(n) {
  return Number(n).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export async function generateAndDownloadPDF(data, filename, onProgress) {
  onProgress?.('Loading PDF engine…')
  const ok = await ensureJsPDF()

  if (!ok || !window.jspdf) {
    onProgress?.('Using HTML fallback…')
    const html = buildHTMLFallback(data)
    downloadBlob(html, 'text/html', filename.replace('.pdf', '.html'))
    return false
  }

  onProgress?.('Building document…')
  const bytes = buildJsPDF(data)
  onProgress?.('Downloading…')
  downloadBlob(bytes, 'application/pdf', filename)
  return true
}

export async function printDocument(data) {
  const ok = await ensureJsPDF()
  if (!ok || !window.jspdf) {
    const html = buildHTMLFallback(data)
    const win = window.open('', '_blank')
    if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 600) }
    return
  }
  const bytes = buildJsPDF(data)
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  iframe.src = url
  document.body.appendChild(iframe)
  iframe.onload = () => {
    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()
    setTimeout(() => { document.body.removeChild(iframe); URL.revokeObjectURL(url) }, 5000)
  }
}

function downloadBlob(content, mimeType, filename) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

function buildJsPDF(data) {
  const jspdf = window.jspdf
  const doc = new jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const PW = 210, ML = 15, MR = 195, BW = MR - ML
  let y = 0

  const drawHeader = () => {
    doc.setFillColor(...PDF_NAVY); doc.rect(0, 0, PW, 30, 'F')
    doc.setFillColor(...PDF_RED); doc.rect(0, 30, PW, 2.5, 'F')
    doc.setFillColor(...PDF_RED); doc.roundedRect(PW - 28, 4, 20, 20, 2, 2, 'F')
    doc.setTextColor(255, 255, 255); doc.setFontSize(12); doc.setFont('helvetica', 'bold')
    doc.text('DLC', PW - 18, 16, { align: 'center' })
    doc.setFontSize(14); doc.text(COMPANY.name, ML, 12)
    doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(255, 255, 255)
    doc.text(`${COMPANY.address}   |   Reg: ${COMPANY.reg}`, ML, 18)
    doc.text(`${COMPANY.phone1} / ${COMPANY.phone2}   |   ${COMPANY.email}`, ML, 23)
  }

  const drawFooter = (p, total) => {
    doc.setFillColor(...PDF_NAVY); doc.rect(0, 285, PW, 12, 'F')
    doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255)
    doc.text(`${COMPANY.name}   |   ${COMPANY.reg}`, ML, 292)
    doc.text(`Page ${p} of ${total}`, MR, 292, { align: 'right' })
  }

  const chk = needed => { if (y + needed > 278) { doc.addPage(); drawHeader(); y = 38 } }

  drawHeader(); y = 37

  // Title
  doc.setFontSize(22); doc.setFont('helvetica', 'bold'); doc.setTextColor(...PDF_DARK)
  doc.text(DOC_TITLES[data.type] || 'CONSTRUCTION DOCUMENT', ML, y + 8); y += 10
  doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...PDF_RED)
  doc.text((data.meta.projectTitle || 'Construction Project').toUpperCase(), ML, y + 5); y += 10

  // Info grid
  const pairs = [
    ['Reference No.', data.meta.quoteNum],
    ['Date Issued', data.meta.date],
    ['Client Name', data.meta.clientName],
    ['Location', data.meta.projectLocation],
  ]
  const cw = BW / 2, rh = 10
  pairs.forEach((pair, i) => {
    const col = i % 2, row = Math.floor(i / 2)
    const gx = ML + col * cw, gy = y + row * rh
    doc.setFillColor(...PDF_LIGHT); doc.rect(gx, gy, cw, rh, 'F')
    doc.setDrawColor(...PDF_GREY); doc.rect(gx, gy, cw, rh, 'S')
    doc.setFontSize(6.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...PDF_RED)
    doc.text(pair[0].toUpperCase(), gx + 4, gy + 3.5)
    doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(...PDF_DARK)
    doc.text(pair[1] || '—', gx + 4, gy + 7.5)
  })
  y += Math.ceil(pairs.length / 2) * rh + 6

  // BOQ table
  const rows = data.boqRows?.length ? data.boqRows : data.materials || []
  if (rows.length) {
    chk(20)
    const tableData = rows.map(r => [
      r.desc || r.description || '',
      r.unit || '',
      r.qty || r.quantity || '—',
      r.clientSupplied ? '—' : (r.rate ? fmtN(parseFloat(r.rate)) : '—'),
      r.clientSupplied ? 'CLIENT' : (r.amount ? fmtN(parseFloat(r.amount)) : '—'),
    ])
    doc.autoTable({
      startY: y,
      head: [['Description', 'Unit', 'Qty', 'Rate (GHS)', 'Amount (GHS)']],
      body: tableData,
      margin: { left: ML, right: PW - MR },
      headStyles: { fillColor: PDF_NAVY, textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8, textColor: PDF_DARK },
      alternateRowStyles: { fillColor: [250, 252, 255] },
      didDrawPage: () => { drawHeader() },
    })
    y = doc.lastAutoTable.finalY + 4
  }

  // Grand total
  const grand = data.contractSum || rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
  chk(18)
  doc.setFillColor(...PDF_NAVY); doc.rect(ML, y, BW, 12, 'F')
  doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(...PDF_GOLD)
  doc.text('CONTRACT SUM', ML + 4, y + 8)
  doc.text(`GHS ${fmtN(grand)}`, MR - 2, y + 8, { align: 'right' })
  y += 16

  // Footer on all pages
  const total = doc.internal.getNumberOfPages()
  for (let p = 1; p <= total; p++) { doc.setPage(p); drawFooter(p, total) }

  return doc.output('arraybuffer')
}

export function buildHTMLFallback(data) {
  const rows = data.boqRows?.length ? data.boqRows : data.materials || []
  const grand = data.contractSum || rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
  const fmtGHS = v => v ? `GHS ${Number(v).toLocaleString('en', { minimumFractionDigits: 2 })}` : '—'

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>${DOC_TITLES[data.type] || 'DOCUMENT'}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Helvetica,Arial,sans-serif;background:#F7F9FC;color:#1a1a2e}
.page{width:794px;min-height:1123px;background:#fff;margin:0 auto}
@media print{body{background:#fff}.page{margin:0;width:100%}}
.hdr{background:#0A2A43;padding:24px 40px 18px;display:flex;justify-content:space-between;align-items:flex-start}
.cn{font-size:17px;font-weight:800;color:#fff;margin-bottom:4px}
.cd{font-size:10px;color:rgba(255,255,255,.72);line-height:1.6}
.logo{width:48px;height:48px;background:#B00020;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;color:#fff}
.acc{height:3.5px;background:linear-gradient(90deg,#B00020,#0A2A43)}
.bd{padding:28px 40px}
.dt{font-size:22px;font-weight:800;color:#0A2A43;margin-bottom:5px}
.ds{font-size:12px;color:#B00020;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:20px}
.ig{display:grid;grid-template-columns:1fr 1fr;border:1px solid #d0d8e8;border-radius:7px;overflow:hidden;margin-bottom:24px;background:#F7F9FC}
.ic{padding:9px 14px;border-right:1px solid #d0d8e8;border-bottom:1px solid #d0d8e8}
.ic:nth-child(even){border-right:none}.ic:last-child,.ic:nth-last-child(2){border-bottom:none}
.il{font-size:9px;font-weight:700;color:#B00020;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px}
.iv{font-size:12px;font-weight:600;color:#0A2A43}
table{width:100%;border-collapse:collapse}
thead tr{background:#0A2A43}
thead th{padding:9px 11px;text-align:left;font-size:10px;font-weight:700;color:#fff;text-transform:uppercase}
thead th.r{text-align:right}
td{padding:7px 11px;border-bottom:1px solid #e0e8f0;font-size:12px}
tr:nth-child(even) td{background:#F7F9FC}
.grand{background:#0A2A43;border-radius:9px;padding:16px 22px;display:flex;justify-content:space-between;align-items:center;margin:20px 0}
.gl{font-size:12px;font-weight:600;color:rgba(255,255,255,.8);text-transform:uppercase;letter-spacing:1px}
.gv{font-size:20px;font-weight:800;color:#FCD34D}
.ftr{background:#0A2A43;padding:12px 40px;display:flex;justify-content:space-between;align-items:center;margin-top:24px}
.fc{font-size:10px;font-weight:700;color:rgba(255,255,255,.9)}
.fr{font-size:9.5px;color:rgba(255,255,255,.6);text-align:right}
</style>
</head>
<body>
<div class="page">
  <div class="hdr">
    <div>
      <div class="cn">${COMPANY.name}</div>
      <div class="cd">${COMPANY.address} | Reg: ${COMPANY.reg}<br/>${COMPANY.phone1} | ${COMPANY.email}</div>
    </div>
    <div class="logo">DLC</div>
  </div>
  <div class="acc"></div>
  <div class="bd">
    <div class="dt">${DOC_TITLES[data.type] || 'DOCUMENT'}</div>
    <div class="ds">${data.meta.projectTitle || 'Construction Project'}</div>
    <div class="ig">
      <div class="ic"><div class="il">Reference No.</div><div class="iv">${data.meta.quoteNum || '—'}</div></div>
      <div class="ic"><div class="il">Date</div><div class="iv">${data.meta.date || '—'}</div></div>
      <div class="ic"><div class="il">Client</div><div class="iv">${data.meta.clientName || '—'}</div></div>
      <div class="ic"><div class="il">Location</div><div class="iv">${data.meta.projectLocation || '—'}</div></div>
    </div>
    ${rows.length ? `
    <table>
      <thead><tr>
        <th>Description</th><th>Unit</th>
        <th class="r">Qty</th><th class="r">Rate (GHS)</th><th class="r">Amount (GHS)</th>
      </tr></thead>
      <tbody>
        ${rows.map(r => `<tr>
          <td>${r.desc || r.description || ''}</td>
          <td>${r.unit || ''}</td>
          <td style="text-align:right">${r.qty || r.quantity || '—'}</td>
          <td style="text-align:right">${r.clientSupplied ? '—' : fmtGHS(r.rate)}</td>
          <td style="text-align:right;font-weight:600;color:${r.clientSupplied ? '#B00020' : '#0A2A43'}">${r.clientSupplied ? 'Client Supply' : fmtGHS(r.amount)}</td>
        </tr>`).join('')}
      </tbody>
    </table>` : ''}
    <div class="grand">
      <div>
        <div class="gl">Total Contract Value</div>
        <div style="font-size:10px;color:rgba(255,255,255,.5)">${data.meta.projectTitle || ''}</div>
      </div>
      <div class="gv">${fmtGHS(grand)}</div>
    </div>
  </div>
  <div class="ftr">
    <div class="fc">${COMPANY.name} | ${COMPANY.reg}</div>
    <div class="fr">${COMPANY.phone1}<br/>${COMPANY.email}</div>
  </div>
</div>
</body>
</html>`
}
