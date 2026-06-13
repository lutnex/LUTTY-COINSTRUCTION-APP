import { C } from '../../utils/constants.js'

const TOOLS = [
  {ico:'📋',t:'BOQ Generation',d:'Measured quantities first, then material price collection — no invented rates.',p:'Follow QS WORKFLOW Phase 1 only: output measured quantities, material list needing prices, assumptions, exclusions, and provisional items. Do NOT price until I supply unit rates.'},
  {ico:'🏗️',t:'Full Project Estimate',d:'Professional estimate with mandatory price confirmation before final totals.',p:'Follow QS WORKFLOW. Phase 1: measurements and clarification only. Ask for each material unit price, specification, and supply type. Do not use assumed market prices.'},
  {ico:'💧',t:'Bathroom Package',d:'Waterproofing, screed, tiles, fixtures — complete bathroom estimate with BOQ table.',p:'Generate a complete bathroom construction BOQ in table format. Ask me dimensions and spec.'},
  {ico:'🔩',t:'Foundation Package',d:'Excavation, blinding, DPC, reinforcement, formwork — full foundation BOQ.',p:'Generate a complete foundation BOQ in table format. Ask me foundation type and dimensions.'},
  {ico:'🔲',t:'Roofing Package',d:'Sheets, ridge, gutters, fascia — complete roofing estimate with quantities.',p:'Generate a roofing BOQ in table format. Ask me roof type, pitch, and plan area.'},
  {ico:'⚠️',t:'Risk Assessment',d:'Full commercial risk analysis — HIGH/MEDIUM/LOW ratings, hidden costs, mitigation.',p:'Perform a full commercial risk assessment. Ask me project type, contract type, and scope.'},
  {ico:'📊',t:'Variation Order',d:'Draft VO with cost breakdown — materials, labour, markup, programme impact.',p:'Draft a variation order. Ask me what changed, who instructed it, and guide me through pricing.'},
  {ico:'🛒',t:'Procurement Plan',d:'Sequencing, long-lead identification, bulk buy opportunities, cash flow.',p:'Generate a procurement plan. Ask me about materials, programme, and budget.'},
  {ico:'💰',t:'Markup Strategy',d:'Optimal contractor margins based on project type and market conditions.',p:'Advise me on contractor markup strategy. Ask me project type, risk level, and current market.'},
  {ico:'🏠',t:'Residential Package',d:'Full residential estimate — all trades, prelims, and commercial summary.',p:'Complete residential construction estimate. Ask me the full pre-estimation checklist.'},
  {ico:'🏛️',t:'Structural Concrete',d:'RC elements with correct 42.5R grade, mix design, reinforcement schedule.',p:'Structural concrete estimate with correct cement grades. Ask me element types and dimensions.'},
  {ico:'🛣️',t:'Civil Engineering',d:'Roads, drainage, earthworks, retaining walls, infrastructure.',p:'Civil engineering estimate. Ask me scope, site conditions, soil type, and location.'},
]

export function ToolsPage({ onLaunch, aiBusy, onOpenMarket }) {
  return (
    <div style={{ flex:1, overflowY:'auto', padding:20 }}>
      <div style={{ fontFamily:"'Bebas Neue'", fontSize:25, letterSpacing:'2px', color:C.amber, marginBottom:3 }}>QUICK TOOLS</div>
      <div style={{ fontSize:12.5, color:C.textDim, marginBottom:20 }}>Specialist AI workflows — QS price collection, clarification, and approved export to Document Generator.</div>

      <div onClick={onOpenMarket}
        style={{ background:'linear-gradient(135deg,rgba(10,42,67,.94),rgba(30,40,56,.97))', border:`1px solid ${C.amber}`, borderRadius:10, padding:16, marginBottom:18, cursor:'pointer' }}>
        <div style={{ fontFamily:"'Bebas Neue'", fontSize:18, color:C.amber, marginBottom:4 }}>📈 Material Market Trends</div>
        <div style={{ fontSize:12, color:C.textDim, lineHeight:1.5 }}>View and manually enter local supplier prices by category. Live data only when you save it — never invented.</div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(265px,1fr))', gap:13 }}>
        {TOOLS.map(t => (
          <div key={t.t} onClick={() => !aiBusy && onLaunch(t.p)}
            style={{ background:C.panel, border:`1px solid ${C.border}`, borderRadius:10, padding:16, cursor: aiBusy ? 'not-allowed' : 'pointer', transition:'all .2s', opacity: aiBusy ? 0.5 : 1 }}
            onMouseEnter={e=>{ if (!aiBusy) { e.currentTarget.style.borderColor=C.amber;e.currentTarget.style.transform='translateY(-3px)';e.currentTarget.style.boxShadow='0 8px 24px rgba(0,0,0,.4)' }}}
            onMouseLeave={e=>{ e.currentTarget.style.borderColor=C.border;e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='none'}}
          >
            <div style={{ fontSize:24, marginBottom:8 }}>{t.ico}</div>
            <div style={{ fontFamily:"'Bebas Neue'", fontSize:16, letterSpacing:'1px', color:C.amber, marginBottom:3 }}>{t.t}</div>
            <div style={{ fontSize:12, color:C.textDim, lineHeight:1.5, marginBottom:8 }}>{t.d}</div>
            <div style={{ fontSize:10, color:C.amberLo, fontFamily:'IBM Plex Mono' }}>AUTO-EXTRACTS → PDF + PROJECT SAVE</div>
          </div>
        ))}
      </div>
    </div>
  )
}
