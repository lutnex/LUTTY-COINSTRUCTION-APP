// ── Number / currency formatters ──────────────────────────────────────────────
export const fmtGHS = (n) => {
  if (n == null || isNaN(n)) return '—'
  return `GHS ${Number(n).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export const fmtN = (n) => {
  if (n == null || isNaN(n)) return '—'
  return Number(n).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export const fmtInt = (n) => {
  if (n == null || isNaN(n)) return '—'
  return Number(n).toLocaleString('en')
}

// ── Date formatters ───────────────────────────────────────────────────────────
export const fmtDate = (isoStr) => {
  if (!isoStr) return '—'
  try {
    return new Date(isoStr).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'long', year: 'numeric',
    })
  } catch {
    return isoStr
  }
}

export const today = () => new Date().toISOString().slice(0, 10)

// ── Valid until ───────────────────────────────────────────────────────────────
export const validUntil = (dateStr, days = 30) => {
  try {
    const d = new Date(dateStr)
    d.setDate(d.getDate() + parseInt(days || 30, 10))
    return fmtDate(d.toISOString())
  } catch {
    return '—'
  }
}

// ── Markdown → HTML (for chat bubbles) ───────────────────────────────────────
export const renderMd = (text) => {
  if (!text) return ''
  let t = text
  t = t.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  t = t.replace(/^####\s(.+)$/gm, `<h4 style="color:#F59E0B;font-size:13px;margin:8px 0 4px">$1</h4>`)
  t = t.replace(/^#{2,3}\s(.+)$/gm, `<h3 style="color:#FCD34D;font-family:'Bebas Neue';font-size:18px;margin:14px 0 5px">$1</h3>`)
  t = t.replace(/^---$/gm, `<hr style="border:none;border-top:1px solid #253040;margin:10px 0"/>`)
  t = t.replace(/`([^`]+)`/g, `<code style="background:#141B24;padding:1px 6px;border-radius:3px;font-family:monospace;font-size:12px;color:#38BDF8">$1</code>`)
  // Tables
  t = t.replace(/((\|[^\n]+\|\n?)+)/g, (m) => {
    const rows = m.trim().split('\n').filter(r => r.trim() && !r.match(/^\|[-| :]+\|$/))
    if (!rows.length) return m
    const hdr = rows[0].split('|').filter(c => c.trim()).map(c =>
      `<th style="background:#141B24;color:#F59E0B;padding:6px 10px;border:1px solid #253040;font-family:monospace;font-size:10px">${c.trim()}</th>`
    ).join('')
    const body = rows.slice(1).map(r =>
      '<tr>' + r.split('|').filter(c => c.trim()).map(c =>
        `<td style="padding:5px 10px;border:1px solid #253040;font-size:12.5px">${c.trim()}</td>`
      ).join('') + '</tr>'
    ).join('')
    return `<table style="width:100%;border-collapse:collapse;margin:10px 0"><thead><tr>${hdr}</tr></thead><tbody>${body}</tbody></table>`
  })
  // Lists
  t = t.replace(/^[•\-\*]\s(.+)$/gm, `<li style="margin:3px 0;color:#6E84A3">$1</li>`)
  t = t.replace(/^\d+\.\s(.+)$/gm, `<li style="margin:3px 0">$1</li>`)
  t = t.replace(/(<li[^>]*>.*?<\/li>\n?)+/g, m => `<ul style="padding-left:18px;margin:6px 0">${m}</ul>`)
  return t
}
