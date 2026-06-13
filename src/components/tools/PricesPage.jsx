import { useState } from 'react'
import { C } from '../../utils/constants.js'
import { Button } from '../shared/Button.jsx'
import { CATEGORY_LABELS, SOURCE_LABELS } from '../../utils/priceProfileTypes.js'
import {
  getActiveProfile,
  getActiveProfileItems,
  updateActiveProfileItems,
  setActiveProfileId,
  createProfile,
} from '../../utils/priceStore.js'

export function PricesPage({ priceProfileState, setPriceProfileState, onPersist, onAIAnalyze, aiBusy }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ material: '', unit: '', price: '', supplier: '', specification: '', category: 'material', location: '', notes: '' })
  const [newProfileName, setNewProfileName] = useState('')

  const activeProfile = getActiveProfile(priceProfileState)
  const prices = getActiveProfileItems(priceProfileState)

  const setPrices = (next) => {
    setPriceProfileState(prev => updateActiveProfileItems(prev, next))
  }

  const save = () => {
    if (!form.material || !form.price) return
    const item = { ...form, id: Date.now(), source: 'manual', lastUpdated: new Date().toISOString().slice(0, 10) }
    setPriceProfileState(prev => {
      const updated = updateActiveProfileItems(prev, [...getActiveProfileItems(prev), item])
      onPersist?.(updated)
      return updated
    })
    setForm({ material: '', unit: '', price: '', supplier: '', specification: '', category: 'material', location: '', notes: '' })
    setShowForm(false)
  }

  const switchProfile = (id) => {
    setPriceProfileState(prev => setActiveProfileId(prev, id))
  }

  const addProfile = () => {
    if (!newProfileName.trim()) return
    setPriceProfileState(prev => createProfile(prev, newProfileName.trim()))
    setNewProfileName('')
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
      <div style={{ fontFamily: "'Bebas Neue'", fontSize: 25, letterSpacing: '2px', color: C.amber, marginBottom: 3 }}>PRICE PROFILES</div>
      <div style={{ fontSize: 12.5, color: C.textDim, marginBottom: 16 }}>Named rate libraries for materials, labour, equipment, and subcontract — injected into BOQ workflow after you choose pricing source</div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={priceProfileState.activeProfileId} onChange={e => switchProfile(e.target.value)} style={sel}>
          {priceProfileState.profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input value={newProfileName} onChange={e => setNewProfileName(e.target.value)} placeholder="New profile name" style={{ ...sel, width: 160 }} />
        <Button onClick={addProfile}>+ New Profile</Button>
        <Button onClick={() => setShowForm(true)}>+ Add Rate</Button>
        {prices.length > 0 && (
          <Button variant="sky" disabled={aiBusy} onClick={() => onAIAnalyze(`Analyze my material rates — are any high or low for the Accra market?\n${prices.map(p => `${p.material}: GHS ${p.price}/${p.unit} (${p.supplier})`).join('\n')}`)}>
            {aiBusy ? '⏳ AI working…' : '🤖 Analyze Rates'}
          </Button>
        )}
      </div>

      {showForm && (
        <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 16, marginBottom: 16, maxWidth: 640 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            {[['Material', 'material', 'Material name…'], ['Specification', 'specification', 'Size/grade…'], ['Unit', 'unit', 'bag / m³ / day…'], ['Price (GHS)', 'price', '0.00'], ['Supplier', 'supplier', 'Supplier…'], ['Location', 'location', 'Accra…'], ['Notes', 'notes', 'Chat context…']].map(([lbl, field, ph]) => (
              <div key={field}>
                <div style={{ fontSize: 10, color: C.textDim, fontFamily: 'IBM Plex Mono', marginBottom: 4, textTransform: 'uppercase' }}>{lbl}</div>
                <input value={form[field]} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} placeholder={ph}
                  style={{ background: C.slate, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, fontFamily: 'DM Sans', fontSize: 13.5, padding: '8px 10px', outline: 'none', width: '100%' }} />
              </div>
            ))}
            <div>
              <div style={{ fontSize: 10, color: C.textDim, fontFamily: 'IBM Plex Mono', marginBottom: 4, textTransform: 'uppercase' }}>Category</div>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={{ background: C.slate, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, fontFamily: 'DM Sans', fontSize: 13.5, padding: '8px 10px', width: '100%' }}>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={save}>Save Rate</Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <div style={{ fontSize: 11, color: C.textFaint, marginBottom: 8 }}>Active: {activeProfile.name} · {prices.length} rates · Updated {activeProfile.updatedAt || '—'}</div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr>
              {['Material', 'Spec', 'Unit', 'Price', 'Category', 'Source', 'Supplier', 'Updated', ''].map(h => (
                <th key={h} style={{ background: C.slate, color: C.amber, padding: '7px 9px', textAlign: 'left', border: `1px solid ${C.border}`, fontFamily: 'IBM Plex Mono', fontSize: 10 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {prices.map(p => (
              <tr key={p.id}>
                <td style={td}>{p.material}</td>
                <td style={td}>{p.specification || '—'}</td>
                <td style={{ ...td, fontFamily: 'IBM Plex Mono', fontSize: 11 }}>{p.unit}</td>
                <td style={{ ...td, fontFamily: 'IBM Plex Mono', color: C.amber }}>GHS {p.price}</td>
                <td style={td}>{CATEGORY_LABELS[p.category] || p.category}</td>
                <td style={td}>{SOURCE_LABELS[p.source] || p.source}</td>
                <td style={td}>{p.supplier || '—'}</td>
                <td style={td}>{p.lastUpdated || '—'}</td>
                <td style={td}><Button variant="red" size="sm" onClick={() => setPrices(pp => pp.filter(x => x.id !== p.id))}>✕</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const td = { border: `1px solid ${C.border}`, padding: '5px 9px', color: C.textDim }
const sel = { background: C.slate, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, fontFamily: 'DM Sans', fontSize: 13, padding: '8px 10px' }
