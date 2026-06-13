/** Normalize BOQ line items with edit metadata. */

export function normalizeBoqRow(row = {}, index = 0) {
  const id = row.id ?? Date.now() + index
  const qty = String(row.qty ?? '')
  const rate = row.clientSupplied ? '0' : String(row.rate ?? '')
  const amount = row.amount != null && row.amount !== ''
    ? String(row.amount)
    : (qty && rate ? String(Math.round(parseFloat(qty) * parseFloat(rate) * 100) / 100) : '')

  return {
    id,
    itemRef: row.itemRef || '',
    section: row.section || 'General',
    desc: row.desc || '',
    unit: row.unit || 'nr',
    qty,
    rate,
    amount,
    clientSupplied: Boolean(row.clientSupplied),
    editable: row.locked ? false : (row.editable !== false),
    deletable: row.locked ? false : (row.deletable !== false),
    locked: Boolean(row.locked),
    source: row.source || 'user',
  }
}

export function createEmptyRow(section = 'General') {
  return normalizeBoqRow({ section, desc: '', unit: 'm²', qty: '', rate: '', amount: '' })
}

export function duplicateBoqRow(row) {
  return normalizeBoqRow({
    ...row,
    id: Date.now(),
    desc: row.desc ? `${row.desc} (copy)` : '',
    source: 'duplicate',
  })
}
