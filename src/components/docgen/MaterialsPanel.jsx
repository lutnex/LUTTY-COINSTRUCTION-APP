import { useState } from 'react'
import { C } from '../../utils/constants.js'
import { fmtN } from '../../utils/formatters.js'
import {
  SUGGESTED_CATEGORIES,
  sameCategoryId,
  categorySubtotal,
  materialsGrandTotal,
} from '../../utils/materialCategories.js'

export default function MaterialsPanel({
  categories,
  materials,
  onAddMaterial,
  onAddCategory,
  onUpdateMaterial,
  onRemoveMaterial,
  onRenameCategory,
  onDeleteCategory,
  onReorderCategories,
  onMoveMaterial,
}) {
  const [showAdd, setShowAdd] = useState(false)
  const [catMode, setCatMode] = useState('existing')
  const [newCatName, setNewCatName] = useState('')
  const [selectedCatId, setSelectedCatId] = useState(() => String(categories[0]?.id ?? ''))
  const [draft, setDraft] = useState({ desc: '', qty: '', unit: 'nr', rate: '' })
  const [dragCatId, setDragCatId] = useState(null)
  const [dragMatId, setDragMatId] = useState(null)

  const grandTotal = materialsGrandTotal(materials)

  const itemsForCategory = (catId) => materials.filter(m => sameCategoryId(m.categoryId, catId))

  const resetAddForm = () => {
    setDraft({ desc: '', qty: '', unit: 'nr', rate: '' })
    setNewCatName('')
    setCatMode('existing')
    setSelectedCatId(String(categories[0]?.id ?? ''))
    setShowAdd(false)
  }

  const handleAddSubmit = (e) => {
    e.preventDefault()
    if (!draft.desc.trim()) return
    const categoryName = catMode === 'new' ? newCatName.trim() : null
    const categoryId = catMode === 'existing' ? selectedCatId : null
    onAddMaterial({ categoryId, categoryName, ...draft })
    resetAddForm()
  }

  const handleCatDrop = (targetId) => {
    if (dragCatId == null || dragCatId === targetId) return
    const from = categories.findIndex(c => sameCategoryId(c.id, dragCatId))
    const to = categories.findIndex(c => sameCategoryId(c.id, targetId))
    onReorderCategories(from, to)
    setDragCatId(null)
  }

  const handleMatDrop = (targetMatId, targetCatId) => {
    if (dragMatId == null) return
    const mat = materials.find(m => m.id === dragMatId)
    if (!mat) return
    const targetIdx = itemsForCategory(targetCatId).findIndex(m => m.id === targetMatId)
    onMoveMaterial(dragMatId, targetCatId, targetIdx >= 0 ? targetIdx : 999)
    setDragMatId(null)
  }

  return (
    <div>
      {categories.map(category => {
        const items = itemsForCategory(category.id)
        return (
        <div
          key={category.id}
          draggable
          onDragStart={() => setDragCatId(category.id)}
          onDragOver={e => e.preventDefault()}
          onDrop={() => handleCatDrop(category.id)}
          style={{
            marginBottom: 14,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            overflow: 'hidden',
            background: C.carbon,
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            background: 'rgba(245,158,11,.08)',
            borderBottom: `1px solid ${C.border}`,
          }}>
            <span style={{ cursor: 'grab', color: C.textFaint, fontSize: 12 }} title="Drag to reorder category">⠿</span>
            <input
              value={category.name}
              onChange={e => onRenameCategory(category.id, e.target.value)}
              style={{ ...inputStyle, flex: 1, fontWeight: 600, color: C.amber, fontFamily: "'Bebas Neue'", fontSize: 14, letterSpacing: 1 }}
            />
            <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 11, color: C.textDim, whiteSpace: 'nowrap' }}>
              Subtotal: GHS {fmtN(categorySubtotal(items))}
            </span>
            {categories.length > 1 && (
              <button type="button" onClick={() => onDeleteCategory(category.id)} style={delBtn} title="Delete category">✕</button>
            )}
          </div>

          <div
            onDragOver={e => e.preventDefault()}
            onDrop={() => dragMatId && handleMatDrop(null, category.id)}
            style={{ padding: '8px 10px' }}
          >
            {items.length === 0 && (
              <div style={{ fontSize: 11, color: C.textFaint, padding: '6px 4px' }}>No materials in this category — drag items here or add below.</div>
            )}
            {items.map(mat => (
              <div
                key={mat.id}
                draggable
                onDragStart={() => setDragMatId(mat.id)}
                onDragOver={e => e.preventDefault()}
                onDrop={() => handleMatDrop(mat.id, category.id)}
                style={{ display: 'flex', gap: 5, marginBottom: 5, alignItems: 'center' }}
              >
                <span style={{ cursor: 'grab', color: C.textFaint, fontSize: 11, flexShrink: 0 }} title="Drag to reorder">⠿</span>
                <select
                  value={String(mat.categoryId)}
                  onChange={e => onMoveMaterial(mat.id, e.target.value, 999)}
                  style={{ ...inputStyle, width: 110, fontSize: 10 }}
                  title="Move to category"
                >
                  {categories.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
                </select>
                <input value={mat.desc} onChange={e => onUpdateMaterial(mat.id, 'desc', e.target.value)} placeholder="Material…" style={{ ...inputStyle, flex: 1 }} />
                <input value={mat.qty} onChange={e => onUpdateMaterial(mat.id, 'qty', e.target.value)} placeholder="Qty" style={{ ...inputStyle, width: 50, textAlign: 'right' }} />
                <input value={mat.unit} onChange={e => onUpdateMaterial(mat.id, 'unit', e.target.value)} placeholder="Unit" style={{ ...inputStyle, width: 50 }} />
                <input value={mat.clientSupply ? '0' : mat.rate} onChange={e => onUpdateMaterial(mat.id, 'rate', e.target.value)} disabled={mat.clientSupply} placeholder="Rate" style={{ ...inputStyle, width: 70, textAlign: 'right' }} />
                <span style={{ fontFamily: "'IBM Plex Mono'", fontSize: 11, color: mat.clientSupply ? '#B00020' : C.amber, width: 70, textAlign: 'right', flexShrink: 0 }}>
                  {mat.amount ? `GHS ${fmtN(parseFloat(mat.amount))}` : '—'}
                </span>
                <input type="checkbox" title="Client Supply" checked={mat.clientSupply} onChange={e => onUpdateMaterial(mat.id, 'clientSupply', e.target.checked)} />
                <button type="button" onClick={() => onRemoveMaterial(mat.id)} style={delBtn}>✕</button>
              </div>
            ))}
          </div>
        </div>
        )
      })}

      <div style={{ ...costRow, marginTop: 8, paddingTop: 10, borderTop: `2px solid ${C.amberLo}` }}>
        <span style={{ color: C.amber, fontWeight: 700, fontFamily: "'Bebas Neue'", letterSpacing: 1 }}>TOTAL MATERIAL COST</span>
        <span style={{ fontFamily: "'IBM Plex Mono'", color: C.amber, fontWeight: 700 }}>GHS {fmtN(grandTotal)}</span>
      </div>

      {!showAdd ? (
        <button type="button" onClick={() => setShowAdd(true)} style={{ ...addBtnStyle, marginTop: 10 }}>+ Add Material</button>
      ) : (
        <form onSubmit={handleAddSubmit} style={{ marginTop: 12, padding: 14, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8 }}>
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 13, letterSpacing: 1, color: C.amber, marginBottom: 10 }}>ADD MATERIAL</div>

          <div style={{ fontSize: 10, color: C.textDim, fontFamily: "'IBM Plex Mono'", textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Select Category</div>
          <div style={{ display: 'flex', gap: 16, marginBottom: 10, fontSize: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.text, cursor: 'pointer' }}>
              <input type="radio" checked={catMode === 'existing'} onChange={() => setCatMode('existing')} />
              Existing Category
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: C.text, cursor: 'pointer' }}>
              <input type="radio" checked={catMode === 'new'} onChange={() => setCatMode('new')} />
              Create New Category
            </label>
          </div>

          {catMode === 'existing' ? (
            <Field label="Category">
              <select value={String(selectedCatId)} onChange={e => setSelectedCatId(e.target.value)} style={inputStyle}>
                {categories.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
              </select>
            </Field>
          ) : (
            <Field label="Category Name">
              <input
                value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
                list="mat-category-suggestions"
                placeholder="e.g. Masonry Works"
                style={inputStyle}
              />
              <datalist id="mat-category-suggestions">
                {SUGGESTED_CATEGORIES.map(n => <option key={n} value={n} />)}
              </datalist>
            </Field>
          )}

          <Field label="Material Name">
            <input value={draft.desc} onChange={e => setDraft(d => ({ ...d, desc: e.target.value }))} style={inputStyle} required />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <Field label="Quantity">
              <input value={draft.qty} onChange={e => setDraft(d => ({ ...d, qty: e.target.value }))} style={inputStyle} />
            </Field>
            <Field label="Unit">
              <input value={draft.unit} onChange={e => setDraft(d => ({ ...d, unit: e.target.value }))} style={inputStyle} />
            </Field>
            <Field label="Rate">
              <input value={draft.rate} onChange={e => setDraft(d => ({ ...d, rate: e.target.value }))} style={inputStyle} />
            </Field>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button type="submit" style={btn('primary', true)}>Add Material</button>
            <button type="button" onClick={resetAddForm} style={btn('outline', true)}>Cancel</button>
            {catMode === 'new' && (
              <button
                type="button"
                onClick={() => onAddCategory(newCatName.trim() || 'New Category')}
                style={btn('outline', true)}
              >
                + Category Only
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 }}>
      <label style={{ fontSize: 10, color: C.textDim, fontFamily: "'IBM Plex Mono'", textTransform: 'uppercase', letterSpacing: 1 }}>{label}</label>
      {children}
    </div>
  )
}

const inputStyle = { background: '#141B24', border: `1px solid #253040`, borderRadius: 6, color: '#DDE5F0', fontFamily: 'DM Sans', fontSize: 12.5, padding: '7px 9px', outline: 'none', width: '100%' }
const costRow = { display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13 }
const delBtn = { background: 'transparent', border: `1px solid #253040`, color: '#F87171', fontSize: 11.5, padding: '3px 7px', cursor: 'pointer', borderRadius: 4 }
const addBtnStyle = { background: 'transparent', border: `1px solid #253040`, color: '#6E84A3', fontSize: 11, padding: '5px 11px', cursor: 'pointer', borderRadius: 6, fontFamily: 'DM Sans' }

function btn(variant = 'outline', sm = false) {
  const p = sm ? '5px 11px' : '7px 14px'
  const fs = sm ? 11.5 : 12.5
  const base = { padding: p, borderRadius: 6, fontSize: fs, fontWeight: 500, cursor: 'pointer', border: 'none', fontFamily: 'DM Sans' }
  const map = {
    primary: { ...base, background: '#F59E0B', color: '#070A0D' },
    outline: { ...base, background: 'transparent', border: `1px solid #253040`, color: '#6E84A3' },
  }
  return map[variant] || base
}
