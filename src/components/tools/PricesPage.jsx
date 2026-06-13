import { useState } from 'react'
import { C } from '../../utils/constants.js'
import { Button } from '../shared/Button.jsx'

export function PricesPage({ prices, setPrices, onAIAnalyze, aiBusy }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ material:'', unit:'', price:'', supplier:'' })

  const save = () => {
    if (!form.material || !form.price) return
    setPrices(p => [...p, { ...form, id: Date.now() }])
    setForm({ material:'', unit:'', price:'', supplier:'' })
    setShowForm(false)
  }

  return (
    <div style={{ flex:1, overflowY:'auto', padding:20 }}>
      <div style={{ fontFamily:"'Bebas Neue'", fontSize:25, letterSpacing:'2px', color:C.amber, marginBottom:3 }}>PRICE PROFILES</div>
      <div style={{ fontSize:12.5, color:C.textDim, marginBottom:16 }}>Saved material rates injected into every AI estimate automatically</div>
      <div style={{ display:'flex', gap:8, marginBottom:14 }}>
        <Button onClick={()=>setShowForm(true)}>+ Add Rate</Button>
        {prices.length>0 && (
          <Button variant="sky" disabled={aiBusy} onClick={()=>onAIAnalyze(`Analyze my material rates — are any high or low for the Accra market?\n${prices.map(p=>`${p.material}: GHS ${p.price}/${p.unit} (${p.supplier})`).join('\n')}`)}>
            {aiBusy ? '⏳ AI working…' : '🤖 Analyze Rates'}
          </Button>
        )}
      </div>
      {showForm && (
        <div style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:8, padding:16, marginBottom:16, maxWidth:480 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
            {[['Material','material','Material name…'],['Unit','unit','bag / m³ / nr…'],['Price (GHS)','price','0.00'],['Supplier','supplier','Supplier name…']].map(([lbl,field,ph]) => (
              <div key={field}>
                <div style={{ fontSize:10, color:C.textDim, fontFamily:'IBM Plex Mono', marginBottom:4, textTransform:'uppercase' }}>{lbl}</div>
                <input value={form[field]} onChange={e=>setForm(f=>({...f,[field]:e.target.value}))} placeholder={ph}
                  style={{ background:C.slate, border:`1px solid ${C.border}`, borderRadius:6, color:C.text, fontFamily:'DM Sans', fontSize:13.5, padding:'8px 10px', outline:'none', width:'100%' }} />
              </div>
            ))}
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <Button onClick={save}>Save Rate</Button>
            <Button variant="outline" onClick={()=>setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
          <thead><tr>{['Material','Unit','Price (GHS)','Supplier',''].map(h=><th key={h} style={{ background:C.slate, color:C.amber, padding:'7px 9px', textAlign:'left', border:`1px solid ${C.border}`, fontFamily:'IBM Plex Mono', fontSize:10 }}>{h}</th>)}</tr></thead>
          <tbody>
            {prices.map(p => (
              <tr key={p.id}>
                <td style={{ border:`1px solid ${C.border}`, padding:'5px 9px', fontWeight:500 }}>{p.material}</td>
                <td style={{ border:`1px solid ${C.border}`, padding:'5px 9px', color:C.textDim, fontFamily:'IBM Plex Mono', fontSize:11 }}>{p.unit}</td>
                <td style={{ border:`1px solid ${C.border}`, padding:'5px 9px', fontFamily:'IBM Plex Mono', color:C.amber }}>GHS {p.price}</td>
                <td style={{ border:`1px solid ${C.border}`, padding:'5px 9px', color:C.textDim }}>{p.supplier}</td>
                <td style={{ border:`1px solid ${C.border}`, padding:'5px 9px' }}><Button variant="red" size="sm" onClick={()=>setPrices(pp=>pp.filter(x=>x.id!==p.id))}>✕</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
