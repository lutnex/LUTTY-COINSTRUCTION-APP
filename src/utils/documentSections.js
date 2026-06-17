/**
 * Document section layout — user-controlled blocks for Document Generator export.
 */

export const SECTION_KINDS = {
  client_info: { defaultTitle: 'Client Information', kind: 'meta' },
  project_scope: { defaultTitle: 'Project Scope', kind: 'richtext' },
  takeoff: { defaultTitle: 'Drawing & Document Takeoff', kind: 'richtext' },
  boq: { defaultTitle: 'Bill of Quantities', kind: 'data' },
  materials: { defaultTitle: 'Materials', kind: 'data' },
  labor: { defaultTitle: 'Labour', kind: 'data' },
  prelims: { defaultTitle: 'Preliminaries', kind: 'data' },
  commercial: { defaultTitle: 'Commercial Summary', kind: 'data' },
  assumptions: { defaultTitle: 'Assumptions', kind: 'richtext' },
  exclusions: { defaultTitle: 'Exclusions & Clarifications', kind: 'richtext' },
  provisional: { defaultTitle: 'Provisional Sums', kind: 'richtext' },
  optional_items: { defaultTitle: 'Optional Items', kind: 'richtext' },
  client_supplied: { defaultTitle: 'Client-Supplied Items', kind: 'richtext' },
  payment_terms: { defaultTitle: 'Payment Terms', kind: 'payment' },
  notes: { defaultTitle: 'Notes', kind: 'richtext' },
  custom: { defaultTitle: 'Custom Section', kind: 'richtext' },
}

const DEFAULT_ORDER = [
  'client_info',
  'project_scope',
  'takeoff',
  'boq',
  'materials',
  'labor',
  'prelims',
  'commercial',
  'assumptions',
  'exclusions',
  'provisional',
  'optional_items',
  'client_supplied',
  'payment_terms',
  'notes',
]

const DEFAULT_ENABLED = new Set([
  'client_info', 'project_scope', 'boq', 'materials', 'labor', 'prelims', 'commercial', 'payment_terms',
])

export function createSection(type, overrides = {}) {
  const def = SECTION_KINDS[type] || SECTION_KINDS.custom
  return {
    id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    title: def.defaultTitle,
    enabled: DEFAULT_ENABLED.has(type),
    locked: false,
    status: 'active',
    html: '',
    ...overrides,
  }
}

export function createDefaultSectionLayout() {
  return DEFAULT_ORDER.map(type => createSection(type))
}

export function getEnabledSections(sections = []) {
  return sections.filter(s => s.enabled && s.status !== 'deleted')
}

export function getSectionByType(sections, type) {
  return sections.find(s => s.type === type && s.status !== 'deleted')
}

export function arrayToListHtml(items = []) {
  if (!items?.length) return ''
  return `<ul>${items.map(i => `<li>${escapeHtml(String(i))}</li>`).join('')}</ul>`
}

export function textToHtml(text = '') {
  if (!text?.trim()) return ''
  if (text.includes('<')) return text
  return text.split('\n').filter(Boolean).map(line => `<p>${escapeHtml(line)}</p>`).join('')
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function stripHtml(html = '') {
  return String(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<li>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim()
}

export function sanitizeRichHtml(html = '') {
  return String(html)
    .replace(/<(?!\/?(p|br|strong|em|b|i|u|ul|ol|li)\b)[^>]+>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
}

export function normalizeDocumentSections(input, { meta, extras } = {}) {
  if (Array.isArray(input) && input.length) {
    return input.map(s => ({
      ...createSection(s.type || 'custom', s),
      id: s.id || createSection(s.type || 'custom').id,
    }))
  }

  const sections = createDefaultSectionLayout()
  const takeoff = extras?.drawingAnalysis?.takeoffNotes
  const assumptions = extras?.assumptions
  const exclusions = extras?.exclusions
  const provisional = extras?.provisional
  const optionalItems = extras?.optionalItems
  const clientSuppliedItems = extras?.clientSuppliedItems

  return sections.map(s => {
    if (s.type === 'project_scope' && meta?.projectDescription) {
      return { ...s, html: textToHtml(meta.projectDescription), enabled: true, status: 'active' }
    }
    if (s.type === 'notes' && meta?.notes) {
      return { ...s, html: textToHtml(meta.notes) }
    }
    if (s.type === 'takeoff' && takeoff) {
      return { ...s, html: textToHtml(takeoff), status: 'suggested', enabled: false }
    }
    if (s.type === 'assumptions' && assumptions?.length) {
      return { ...s, html: arrayToListHtml(assumptions), status: 'suggested', enabled: false }
    }
    if (s.type === 'exclusions' && exclusions?.length) {
      return { ...s, html: arrayToListHtml(exclusions), status: 'suggested', enabled: false }
    }
    if (s.type === 'provisional' && provisional?.length) {
      return { ...s, html: arrayToListHtml(provisional), status: 'suggested', enabled: false }
    }
    if (s.type === 'optional_items' && optionalItems?.length) {
      return { ...s, html: arrayToListHtml(optionalItems.map(i => i.desc || i)), status: 'suggested', enabled: false }
    }
    if (s.type === 'client_supplied' && clientSuppliedItems?.length) {
      return { ...s, html: arrayToListHtml(clientSuppliedItems.map(i => `${i.desc} (${i.qty || '—'} ${i.unit || ''})`)), status: 'suggested', enabled: false }
    }
    return s
  })
}

export function markdownToExportHtml(text = '') {
  if (!text?.trim()) return ''

  function tableBlockToHtml(block) {
    const rows = block.trim().split('\n').filter(r => r.trim() && !/^\|[-| :]+\|$/.test(r.trim()))
    if (rows.length < 1) return ''
    const headerCells = rows[0].split('|').filter(c => c.trim()).map(c => `<th>${escapeHtml(c.trim())}</th>`).join('')
    const bodyRows = rows.slice(1).map(row => {
      const cells = row.split('|').filter(c => c.trim()).map(c => `<td>${escapeHtml(c.trim())}</td>`).join('')
      return `<tr>${cells}</tr>`
    }).join('')
    if (!bodyRows) return ''
    return `<table class="data"><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>`
  }

  const parts = []
  const tableRx = /((?:\|[^\n]+\|\n?)+)/g
  let last = 0
  let m
  while ((m = tableRx.exec(text)) !== null) {
    if (m.index > last) {
      const chunk = text.slice(last, m.index)
        .replace(/^#{2,4}\s+(.+)$/gm, (_, title) => `<h3>${escapeHtml(title.trim())}</h3>`)
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      parts.push(textToHtml(chunk))
    }
    parts.push(tableBlockToHtml(m[1]))
    last = m.index + m[0].length
  }
  if (last < text.length) {
    const chunk = text.slice(last)
      .replace(/^#{2,4}\s+(.+)$/gm, (_, title) => `<h3>${escapeHtml(title.trim())}</h3>`)
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    parts.push(textToHtml(chunk))
  }
  return parts.filter(Boolean).join('')
}

function appendChatFallbackSection(sections, sourceText, { hasBoq } = {}) {
  if (hasBoq || !sourceText?.trim()) return sections
  const html = markdownToExportHtml(sourceText)
  if (!stripHtml(html).trim()) return sections
  const existing = sections.find(s => s.type === 'notes')
  if (existing) {
    return sections.map(s => s.type === 'notes'
      ? { ...s, title: 'AI Estimate Output', html, enabled: true, status: 'active' }
      : s)
  }
  return [
    ...sections,
    createSection('custom', { title: 'AI Estimate Output', html, enabled: true, status: 'active' }),
  ]
}

/** Like normalizeDocumentSections but enables blocks that have AI/chat content for PDF/HTML export. */
export function normalizeDocumentSectionsForExport(input, { meta, extras, sourceText, hasBoq } = {}) {
  let sections = normalizeDocumentSections(input, { meta, extras })
  sections = sections.map(s => {
    if (s.status === 'deleted') return s
    const hasHtml = stripHtml(s.html || '').trim().length > 0
    if (hasHtml) {
      return { ...s, enabled: true, status: 'active' }
    }
    return s
  })
  return appendChatFallbackSection(sections, sourceText, { hasBoq })
}

export function applyAiSuggestionsToSections(sections, extract) {
  if (!extract) return sections

  const updates = {
    takeoff: extract.takeoffNotes || extract.drawingAnalysis?.takeoffNotes,
    assumptions: extract.assumptions,
    exclusions: extract.exclusions,
    provisional: extract.provisional,
    optional_items: extract.optionalItems,
    client_supplied: extract.clientSuppliedItems,
    project_scope: extract.projectScope || extract.projectDescription,
  }

  return sections.map(section => {
    if (section.locked) return section
    const val = updates[section.type]
    if (!val) return section
    if (section.type === 'assumptions' || section.type === 'exclusions' || section.type === 'provisional') {
      if (!val?.length) return section
      return {
        ...section,
        html: arrayToListHtml(val),
        status: 'suggested',
        enabled: false,
      }
    }
    if (section.type === 'optional_items' || section.type === 'client_supplied') {
      if (!val?.length) return section
      const items = val.map(i => (typeof i === 'string' ? i : `${i.desc || i.name || 'Item'}${i.qty ? ` (${i.qty} ${i.unit || ''})` : ''}`))
      return { ...section, html: arrayToListHtml(items), status: 'suggested', enabled: false }
    }
    if (section.type === 'takeoff' && val) {
      return { ...section, html: textToHtml(val), status: 'suggested', enabled: false }
    }
    if (section.type === 'project_scope' && val && section.status !== 'active') {
      return { ...section, html: textToHtml(val), status: 'suggested', enabled: section.enabled }
    }
    return section
  })
}

export function reorderSections(sections, fromIndex, toIndex) {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return sections
  const copy = [...sections]
  const [item] = copy.splice(fromIndex, 1)
  copy.splice(toIndex, 0, item)
  return copy
}

export function duplicateSection(sections, id) {
  const source = sections.find(s => s.id === id)
  if (!source) return sections
  const copy = createSection(source.type === 'custom' ? 'custom' : 'custom', {
    title: `${source.title} (Copy)`,
    html: source.html,
    enabled: source.enabled,
    status: 'active',
  })
  const idx = sections.findIndex(s => s.id === id)
  const next = [...sections]
  next.splice(idx + 1, 0, copy)
  return next
}

export function deleteSection(sections, id) {
  return sections.filter(s => s.id !== id)
}

export function syncSectionHtmlToMeta(sections, meta) {
  const scope = getSectionByType(sections, 'project_scope')
  const notes = getSectionByType(sections, 'notes')
  return {
    ...meta,
    projectDescription: scope?.html ? stripHtml(scope.html) : meta.projectDescription,
    notes: notes?.html ? stripHtml(notes.html) : meta.notes,
  }
}

export function sectionsToLegacyExtras(sections) {
  const takeoff = getSectionByType(sections, 'takeoff')
  const assumptions = getSectionByType(sections, 'assumptions')
  const exclusions = getSectionByType(sections, 'exclusions')
  return {
    drawingAnalysis: { takeoffNotes: takeoff?.enabled ? stripHtml(takeoff.html) : '' },
    assumptions: assumptions?.enabled ? stripHtml(assumptions.html).split('\n').filter(Boolean) : [],
    exclusions: exclusions?.enabled ? stripHtml(exclusions.html).split('\n').filter(Boolean) : [],
  }
}
