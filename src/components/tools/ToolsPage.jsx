import { C } from '../../utils/constants.js'

const TOOLS = [
  {ico:'🏗️',t:'Full Project Estimate',d:'Complete estimate with BOQ table, commercial summary and risks. Asks mandatory checklist.',p:'Generate a complete project estimate with full BOQ in table format, commercial summary with CONTRACT SUM, and risks. Begin with the mandatory 11-point checklist.'},
  {ico:'📋',t:'BOQ Generation',d:'Full Bill of Quantities by trade section in standard table format — ready for direct import.',p:'Generate a complete professional BOQ using master bills B1–B25. Upload drawings for automatic takeoff. Include assumptions, collections, commercial summary, and risk register.'},
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

export function ToolsPage({ onLaunch, aiBusy }) {
  return (
    <div style={{ flex:1, overflowY:'auto', padding:20 }}>
      <div style={{ fontFamily:"'Bebas Neue'", fontSize:25, letterSpacing:'2px', color:C.amber, marginBottom:3 }}>QUICK TOOLS</div>
      <div style={{ fontSize:12.5, color:C.textDim, marginBottom:20 }}>Specialist AI workflows — every response includes workflow action buttons for PDF export and project saving.</div>
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
