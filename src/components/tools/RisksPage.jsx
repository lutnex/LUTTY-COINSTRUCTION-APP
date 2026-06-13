import { C } from '../../utils/constants.js'
import { Button } from '../shared/Button.jsx'
import { StatusBadge } from '../shared/StatusBadge.jsx'

const RATINGS = ['HIGH','MEDIUM','LOW']
const LIKELIHOODS = ['High','Medium','Low']

export function RisksPage({ risks, setRisks, onAIAnalyze, aiBusy }) {
  const upd = (id, field, val) => setRisks(r => r.map(x => x.id===id ? {...x,[field]:val} : x))

  return (
    <div style={{ flex:1, overflowY:'auto', padding:20 }}>
      <div style={{ fontFamily:"'Bebas Neue'", fontSize:25, letterSpacing:'2px', color:C.amber, marginBottom:3 }}>RISK REGISTER</div>
      <div style={{ fontSize:12.5, color:C.textDim, marginBottom:16 }}>Commercial and technical risk management</div>
      <div style={{ display:'flex', gap:8, marginBottom:14 }}>
        <Button onClick={() => setRisks(r => [...r, {id:Date.now(),risk:'',likelihood:'Medium',impact:'Medium',rating:'MEDIUM',mitigation:''}])}>+ Add Risk</Button>
        <Button variant="sky" disabled={aiBusy} onClick={() => onAIAnalyze(`Analyze these project risks and provide mitigation strategies:\n${risks.map(r=>`${r.risk}|${r.rating}|${r.mitigation}`).join('\n')}`)}>
          {aiBusy ? '⏳ AI working…' : '🤖 AI Analysis'}
        </Button>
      </div>
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
          <thead><tr>{['#','Risk Description','Likelihood','Impact','Rating','Mitigation',''].map(h => <th key={h} style={{ background:C.slate, color:C.amber, padding:'7px 9px', textAlign:'left', border:`1px solid ${C.border}`, fontFamily:'IBM Plex Mono', fontSize:10 }}>{h}</th>)}</tr></thead>
          <tbody>
            {risks.map((r,i) => (
              <tr key={r.id}>
                <td style={{ border:`1px solid ${C.border}`, padding:'5px 9px', fontFamily:'IBM Plex Mono', fontSize:10, color:C.textFaint }}>{i+1}</td>
                <td style={{ border:`1px solid ${C.border}`, padding:'5px 9px' }}><input value={r.risk} onChange={e=>upd(r.id,'risk',e.target.value)} style={{ background:'transparent', border:'none', outline:'none', color:C.text, fontSize:12.5, width:'100%' }} placeholder="Risk description…" /></td>
                <td style={{ border:`1px solid ${C.border}`, padding:'5px 9px' }}><select value={r.likelihood} onChange={e=>upd(r.id,'likelihood',e.target.value)} style={{ background:'transparent', border:'none', outline:'none', color:C.text, fontSize:12 }}>{LIKELIHOODS.map(l=><option key={l}>{l}</option>)}</select></td>
                <td style={{ border:`1px solid ${C.border}`, padding:'5px 9px' }}><select value={r.impact} onChange={e=>upd(r.id,'impact',e.target.value)} style={{ background:'transparent', border:'none', outline:'none', color:C.text, fontSize:12 }}>{LIKELIHOODS.map(l=><option key={l}>{l}</option>)}</select></td>
                <td style={{ border:`1px solid ${C.border}`, padding:'5px 9px' }}>
                  <select value={r.rating} onChange={e=>upd(r.id,'rating',e.target.value)} style={{ background:'transparent', border:'none', outline:'none', fontFamily:'IBM Plex Mono', fontSize:11, color: r.rating==='HIGH'?C.red:r.rating==='MEDIUM'?C.orange:C.green }}>
                    {RATINGS.map(rt=><option key={rt}>{rt}</option>)}
                  </select>
                </td>
                <td style={{ border:`1px solid ${C.border}`, padding:'5px 9px' }}><input value={r.mitigation} onChange={e=>upd(r.id,'mitigation',e.target.value)} style={{ background:'transparent', border:'none', outline:'none', color:C.textDim, fontSize:12, width:'100%' }} placeholder="Mitigation strategy…" /></td>
                <td style={{ border:`1px solid ${C.border}`, padding:'5px 9px' }}><Button variant="red" size="sm" onClick={()=>setRisks(r2=>r2.filter(x=>x.id!==r.id))}>✕</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
