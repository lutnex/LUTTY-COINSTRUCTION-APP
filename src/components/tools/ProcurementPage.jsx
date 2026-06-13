import { C, BOQ_SECTIONS } from '../../utils/constants.js'
import { Button } from '../shared/Button.jsx'

const UNITS = ['bags','nr','m²','m³','tonnes','sets','rolls','lm','sheets']
const STATUSES = ['pending','quoted','ordered','delivered','urgent']

export function ProcurementPage({ proc, setProc, onAIReview, aiBusy }) {
  const upd = (id, field, val) => setProc(p => p.map(x => x.id===id ? {...x,[field]:val} : x))

  return (
    <div style={{ flex:1, overflowY:'auto', padding:20 }}>
      <div style={{ fontFamily:"'Bebas Neue'", fontSize:25, letterSpacing:'2px', color:C.amber, marginBottom:3 }}>PROCUREMENT SCHEDULE</div>
      <div style={{ fontSize:12.5, color:C.textDim, marginBottom:16 }}>Track and manage material procurement — flag long-lead items</div>
      <div style={{ display:'flex', gap:8, marginBottom:14 }}>
        <Button onClick={() => setProc(p => [...p, {id:Date.now(),material:'',supplier:'',quantity:'',unit:'bags',leadTime:'',status:'pending',price:'',longLead:false}])}>+ Add Item</Button>
        <Button variant="sky" disabled={aiBusy} onClick={() => onAIReview(`Review my procurement schedule and advise on sequencing and long-lead risks:\n${proc.map(p=>`${p.material}|${p.quantity}${p.unit}|${p.leadTime}|${p.status}`).join('\n')}`)}>
          {aiBusy ? '⏳ AI working…' : '🤖 AI Advice'}
        </Button>
      </div>
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
          <thead><tr>{['Material','Supplier','Qty','Unit','Lead Time','Status','Price (GHS)','LL',''].map(h => <th key={h} style={{ background:C.slate, color:C.amber, padding:'7px 9px', textAlign:'left', border:`1px solid ${C.border}`, fontFamily:'IBM Plex Mono', fontSize:10, letterSpacing:'.7px' }}>{h}</th>)}</tr></thead>
          <tbody>
            {proc.map(p => (
              <tr key={p.id}>
                <td style={{ border:`1px solid ${C.border}`, padding:'4px 8px' }}>
                  <input value={p.material} onChange={e=>upd(p.id,'material',e.target.value)} style={{ background:'transparent', border:'none', outline:'none', color:C.text, fontSize:12.5, width:'100%' }} placeholder="Material…" />
                  {p.longLead && <span style={{ background:'rgba(248,113,113,.1)', border:'1px solid rgba(248,113,113,.3)', borderRadius:4, padding:'1px 5px', fontSize:10, color:C.red, fontFamily:'IBM Plex Mono', marginLeft:4 }}>LONG LEAD</span>}
                </td>
                <td style={{ border:`1px solid ${C.border}`, padding:'4px 8px' }}><input value={p.supplier} onChange={e=>upd(p.id,'supplier',e.target.value)} style={{ background:'transparent', border:'none', outline:'none', color:C.text, fontSize:12.5, width:'100%' }} /></td>
                <td style={{ border:`1px solid ${C.border}`, padding:'4px 8px' }}><input value={p.quantity} onChange={e=>upd(p.id,'quantity',e.target.value)} style={{ background:'transparent', border:'none', outline:'none', color:C.text, fontSize:12.5, width:60, textAlign:'right' }} /></td>
                <td style={{ border:`1px solid ${C.border}`, padding:'4px 8px' }}>
                  <select value={p.unit} onChange={e=>upd(p.id,'unit',e.target.value)} style={{ background:'transparent', border:'none', outline:'none', color:C.text, fontSize:12 }}>
                    {UNITS.map(u => <option key={u}>{u}</option>)}
                  </select>
                </td>
                <td style={{ border:`1px solid ${C.border}`, padding:'4px 8px' }}><input value={p.leadTime} onChange={e=>upd(p.id,'leadTime',e.target.value)} style={{ background:'transparent', border:'none', outline:'none', color:C.text, fontSize:12.5, width:90 }} placeholder="3–5 days" /></td>
                <td style={{ border:`1px solid ${C.border}`, padding:'4px 8px' }}>
                  <select value={p.status} onChange={e=>upd(p.id,'status',e.target.value)} style={{ background:'transparent', border:'none', outline:'none', fontSize:12, color: p.status==='delivered'?C.green:p.status==='ordered'?C.sky:p.status==='urgent'?C.red:C.textDim }}>
                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </td>
                <td style={{ border:`1px solid ${C.border}`, padding:'4px 8px' }}><input value={p.price} onChange={e=>upd(p.id,'price',e.target.value)} style={{ background:'transparent', border:'none', outline:'none', color:C.amber, fontFamily:'IBM Plex Mono', fontSize:12, textAlign:'right', width:'100%' }} placeholder="0.00" /></td>
                <td style={{ border:`1px solid ${C.border}`, padding:'4px 8px', textAlign:'center' }}><input type="checkbox" checked={p.longLead} onChange={e=>upd(p.id,'longLead',e.target.checked)} /></td>
                <td style={{ border:`1px solid ${C.border}`, padding:'4px 8px' }}><Button variant="red" size="sm" onClick={()=>setProc(p2=>p2.filter(x=>x.id!==p.id))}>✕</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
