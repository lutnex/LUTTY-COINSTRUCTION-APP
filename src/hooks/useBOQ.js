import { useState, useCallback, useMemo, useEffect } from 'react'
import { normalizeBoqRow, createEmptyRow, duplicateBoqRow } from '../utils/boqItemFactory.js'
import { computeBoqBuilderTotals } from '../services/pricing/pricingEngine.js'
import { coerceFieldValue } from '../utils/safeSerialize.js'

/**
 * @param {object} [intelligence] — optional { data, setBoqItems } from ProjectIntelligenceContext
 */
export function useBOQ(intelligence = null, financialAdjustments = null) {
  const external = Boolean(intelligence?.setBoqItems)
  const [localRows, setLocalRows] = useState([])
  const [section, setSection] = useState('All')
  const [initialized, setInitialized] = useState(false)

  const rows = external ? (intelligence.data?.boqItems ?? []) : localRows
  const setRows = external ? intelligence.setBoqItems : setLocalRows

  useEffect(() => {
    if (initialized || external) return
    setInitialized(true)
  }, [initialized, external])

  const update = useCallback((id, field, val) => {
    const safeVal = coerceFieldValue(val)
    if (safeVal === undefined) return
    setRows(prev => prev.map(r => {
      if (r.id !== id || r.locked) return r
      if (!r.editable && field !== 'clientSupplied') return r
      const u = { ...r, [field]: safeVal }
      if ((field === 'qty' || field === 'rate') && !u.clientSupplied) {
        const q = parseFloat(u.qty) || 0
        const rt = parseFloat(u.rate) || 0
        u.amount = (q && rt) ? (q * rt).toFixed(2) : ''
      }
      if (field === 'clientSupplied' && safeVal === true) u.rate = '0'
      return u
    }))
  }, [setRows])

  const addRow = useCallback((sec = 'General') => {
    setRows(prev => [...prev, createEmptyRow(sec)])
  }, [setRows])

  const removeRow = useCallback((id) => {
    setRows(prev => prev.filter(r => {
      if (r.id !== id) return true
      if (r.locked || r.deletable === false) return true
      return false
    }))
  }, [setRows])

  const duplicateRow = useCallback((id) => {
    const row = rows.find(r => r.id === id)
    if (row) setRows(prev => [...prev, duplicateBoqRow(row)])
  }, [rows, setRows])

  const importRows = useCallback((incoming, { replace = false } = {}) => {
    const normalized = incoming.map((r, i) => normalizeBoqRow({ ...r, source: 'import' }, i))
    if (replace) {
      setRows(normalized)
      return
    }
    setRows(prev => {
      const seen = new Set(prev.map(r => `${r.section}|${r.desc}`.toLowerCase()))
      const fresh = normalized.filter(r => !seen.has(`${r.section}|${r.desc}`.toLowerCase()))
      return [...prev, ...fresh]
    })
  }, [setRows])

  const clear = useCallback(() => {
    setRows([])
  }, [setRows])

  const filtered = section === 'All' ? rows : rows.filter(r => r.section === section)

  const totals = useMemo(() => {
    if (external && intelligence.data?.pricing) {
      const p = intelligence.data.pricing
      return { ...p.summary, grand: p.layers.finalEstimate, mode: p.mode }
    }
    return { ...computeBoqBuilderTotals(rows, { financialAdjustments }), mode: 'manual' }
  }, [rows, external, intelligence?.data?.pricing, financialAdjustments])

  const pricingAudit = useMemo(() => {
    if (external && intelligence.data?.pricing) return intelligence.data.pricing
    return computeBoqBuilderTotals(rows)
  }, [rows, external, intelligence?.data?.pricing])

  return {
    rows,
    filtered,
    section,
    setSection,
    totals,
    pricingAudit,
    update,
    addRow,
    removeRow,
    duplicateRow,
    importRows,
    clear,
    setRows,
  }
}
