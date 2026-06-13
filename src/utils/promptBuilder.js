const MAX_BOQ_ROWS_FULL = 80
const MAX_BOQ_ROWS_SAMPLE = 40

/** Compact pipe-delimited row for prompts. */
function rowLine(r, i) {
  return `${i + 1}|${r.section}|${r.desc}|${r.unit}|${r.qty}|${r.rate}|${r.amount}|${r.clientSupplied ? 'CLIENT' : 'CON'}`
}

/**
 * Serialize BOQ rows for AI — full detail up to MAX_BOQ_ROWS_FULL,
 * then section summaries + sample rows to limit token usage.
 */
export function serializeBOQForPrompt(rows = []) {
  if (!rows.length) return { text: '', truncated: false, totalRows: 0 }

  if (rows.length <= MAX_BOQ_ROWS_FULL) {
    return {
      text: rows.map(rowLine).join('\n'),
      truncated: false,
      totalRows: rows.length,
    }
  }

  const bySection = {}
  for (const r of rows) {
    const s = r.section || 'General'
    if (!bySection[s]) bySection[s] = { count: 0, amount: 0 }
    bySection[s].count += 1
    bySection[s].amount += parseFloat(r.amount) || 0
  }

  const summary = Object.entries(bySection)
    .map(([sec, v]) => `${sec}: ${v.count} items, GHS ${v.amount.toLocaleString('en')}`)
    .join('\n')

  const head = rows.slice(0, Math.floor(MAX_BOQ_ROWS_SAMPLE / 2))
  const tail = rows.slice(-Math.floor(MAX_BOQ_ROWS_SAMPLE / 2))
  const sample = [...head, ...tail].map((r, i) => rowLine(r, i))

  return {
    text: [
      `[BOQ SUMMARY — ${rows.length} total rows]`,
      summary,
      '',
      `[SAMPLE ROWS — first ${head.length} + last ${tail.length}]`,
      ...sample,
    ].join('\n'),
    truncated: true,
    totalRows: rows.length,
  }
}

/** Prompt for full BOQ generation from drawings (master template). */
export function buildBOQFromDrawingPrompt(notes = '') {
  return `Generate a complete professional Bill of Quantities from the attached construction drawings/documents.
Use the master bill structure (B1–B25), full trade coverage, drawing takeoff, assumptions, exclusions, material/labour schedules, commercial summary, and risk register.
${notes ? `Additional instructions: ${notes}` : 'Infer all dimensions from drawings — do not ask for dimensions already visible.'}`
}

/** Serialize BOQ rows into an AI review prompt. */
export function buildBOQReviewPrompt(rows = []) {
  if (!rows.length) {
    return 'Review my empty BOQ and suggest standard line items for a typical Ghana residential project (substructure, superstructure, roofing, finishes).'
  }

  const { text, truncated, totalRows } = serializeBOQForPrompt(rows)
  const note = truncated
    ? `\n\nNote: BOQ has ${totalRows} rows — showing section summary and sample rows only. Comment on patterns and flag likely gaps by section.`
    : ''

  return `Review this Bill of Quantities for completeness, unit consistency, quantity logic, and Accra/Ghana market pricing. Flag errors and missing items:\n\n${text}${note}\n\nProvide section comments and an overall commercial assessment.`
}

/** Coerce UI inputs (string, array, object) into prompt text. */
export function normalizePromptInput(input) {
  if (input == null) return ''
  if (typeof input === 'string') return input.trim()
  if (Array.isArray(input)) return buildBOQReviewPrompt(input)
  if (typeof input === 'object' && typeof input.prompt === 'string') return input.prompt.trim()
  return String(input).trim()
}
