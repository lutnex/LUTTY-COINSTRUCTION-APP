/** Normalize BOQ line items with QS workflow metadata. */

import { SUPPLY_TYPES, PRICE_SOURCES } from './qsWorkflow.js'

export function normalizeBoqRow(row = {}, index = 0) {
  const id = row.id ?? Date.now() + index
  const qty = String(row.qty ?? '')
  const clientSupplied = Boolean(row.clientSupplied || row.supplyType === SUPPLY_TYPES.CLIENT)
  const rate = clientSupplied ? '0' : String(row.rate ?? '')
  const amount = row.amount != null && row.amount !== ''
    ? String(row.amount)
    : (qty && rate ? String(Math.round(parseFloat(qty) * parseFloat(rate) * 100) / 100) : '')

  let supplyType = row.supplyType || SUPPLY_TYPES.CONTRACTOR
  if (clientSupplied) supplyType = SUPPLY_TYPES.CLIENT
  if (/provisional|pc sum/i.test(`${row.desc} ${row.section}`)) supplyType = SUPPLY_TYPES.PROVISIONAL
  if (/optional/i.test(row.desc)) supplyType = SUPPLY_TYPES.OPTIONAL
  if (/excluded|exclusion/i.test(row.desc)) supplyType = SUPPLY_TYPES.EXCLUDED

  return {
    id,
    itemRef: row.itemRef || '',
    section: row.section || 'General',
    desc: row.desc || '',
    specification: row.specification || '',
    unit: row.unit || 'nr',
    qty,
    rate,
    amount,
    clientSupplied,
    supplyType,
    supplier: row.supplier || '',
    priceSource: row.priceSource || (rate ? PRICE_SOURCES.ASSUMPTION : PRICE_SOURCES.PENDING),
    priceConfirmed: Boolean(row.priceConfirmed),
    priceLocked: Boolean(row.priceLocked),
    optional: supplyType === SUPPLY_TYPES.OPTIONAL,
    provisional: supplyType === SUPPLY_TYPES.PROVISIONAL,
    excluded: supplyType === SUPPLY_TYPES.EXCLUDED,
    hideInPremium: Boolean(row.hideInPremium),
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
