import { useMemo } from 'react'
import { C } from '../../utils/constants.js'
import {
  buildClarificationPacket,
  validatePreExport,
  identifyMissingMaterialPrices,
} from '../../utils/qsWorkflow.js'
import { presentationStyleLabel } from '../../utils/workflowActions.js'

/** AI result review panel — summary, warnings, and user approval. */
export default function WorkflowReviewDialog({ open, data, presentationStyle, onApprove, onClose }) {
  const rows = useMemo(() => Array.isArray(data?.boqItems) ? data.boqItems : [], [data])
  const assumptions = data?.assumptions || []
  const exclusions = data?.exclusions || []

  const packet = useMemo(
    () => buildClarificationPacket({ ...data, boqItems: rows }),
    [data, rows],
  )

  const missingPrices = useMemo(
    () => identifyMissingMaterialPrices(rows),
    [rows],
  )

  const review = useMemo(
    () => validatePreExport({ ...data, boqItems: rows }, { presentationStyle }),
    [data, rows, presentationStyle],
  )

  if (!open) return null

  const total = review.finalTotal || data?.contractSum || data?.pricing?.layers?.finalEstimate || 0
  const styleLabel = presentationStyleLabel(presentationStyle)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 22, maxWidth: 720, width: '95vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.55)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ fontFamily: "'Bebas Neue'", fontSize: 24, color: C.amber, letterSpacing: 2 }}>AI RESULT REVIEW</div>
            <div style={{ fontSize: 12, color: C.textDim, marginTop: 4 }}>Confirm measurements, assumptions, and pricing before export</div>
          </div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: C.textDim, fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, marginBottom: 16 }}>
          <Stat label="BOQ lines" value={rows.length} />
          <Stat label="Missing prices" value={missingPrices.length} warn={missingPrices.length > 0} />
          <Stat label="Assumptions" value={assumptions.length} />
          <Stat label="Provisional" value={packet.provisionalItems.length} />
          <Stat label="Total (GHS)" value={Number(total).toLocaleString('en', { minimumFractionDigits: 2 })} highlight />
        </div>

        {data?.projectInfo?.title && (
          <Row label="Project" value={data.projectInfo.title} />
        )}
        {data?.client?.name && (
          <Row label="Client" value={data.client.name} />
        )}
        {styleLabel && (
          <Row label="Document style" value={styleLabel} />
        )}

        {assumptions.length > 0 && (
          <Section title={`Assumptions (${assumptions.length})`}>
            <ul style={{ margin: 0, paddingLeft: 18, color: C.text, fontSize: 12.5, lineHeight: 1.6 }}>
              {assumptions.slice(0, 8).map((a, i) => <li key={i}>{a}</li>)}
              {assumptions.length > 8 && <li style={{ color: C.textDim }}>+ {assumptions.length - 8} more</li>}
            </ul>
          </Section>
        )}

        {packet.provisionalItems.length > 0 && (
          <Section title={`Provisional sums (${packet.provisionalItems.length})`}>
            <ul style={{ margin: 0, paddingLeft: 18, color: C.text, fontSize: 12.5 }}>
              {packet.provisionalItems.slice(0, 6).map((p, i) => <li key={i}>{String(p)}</li>)}
            </ul>
          </Section>
        )}

        {missingPrices.length > 0 && (
          <Section title="Items needing rates" warn>
            {missingPrices.slice(0, 5).map(p => (
              <div key={p.id} style={{ fontSize: 12, color: C.textDim, marginBottom: 4 }}>• {p.material} ({p.unit})</div>
            ))}
            {missingPrices.length > 5 && <div style={{ fontSize: 11, color: C.textFaint }}>+ {missingPrices.length - 5} more</div>}
          </Section>
        )}

        {review.warnings.map(w => (
          <div key={w} style={{ fontSize: 12, color: C.amber, marginBottom: 6 }}>⚠ {w}</div>
        ))}
        {review.blockers.map(b => (
          <div key={b} style={{ fontSize: 12, color: C.red, marginBottom: 6 }}>⛔ {b}</div>
        ))}

        {exclusions.length > 0 && (
          <Section title={`Exclusions (${exclusions.length})`}>
            <ul style={{ margin: 0, paddingLeft: 18, color: C.textDim, fontSize: 12 }}>
              {exclusions.slice(0, 4).map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </Section>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <button type="button" onClick={onClose} style={ghostBtn}>Cancel</button>
          <button type="button" onClick={() => onApprove?.()} style={primaryBtn}>Approve Review</button>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value, warn, highlight }) {
  return (
    <div style={{ background: C.slate, border: `1px solid ${warn ? 'rgba(248,113,113,.3)' : C.border}`, borderRadius: 8, padding: '10px 12px' }}>
      <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: highlight ? 14 : 16, color: warn ? C.red : highlight ? C.gold : C.amber, fontWeight: 600 }}>{value}</div>
      <div style={{ fontSize: 9, color: C.textFaint, textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 }}>{label}</div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 10, fontSize: 12.5, marginBottom: 6 }}>
      <span style={{ color: C.textDim, minWidth: 110 }}>{label}</span>
      <span style={{ color: C.text }}>{value}</span>
    </div>
  )
}

function Section({ title, children, warn }) {
  return (
    <div style={{ marginTop: 14, marginBottom: 8 }}>
      <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 10, color: warn ? C.red : C.amber, letterSpacing: 1, marginBottom: 6, textTransform: 'uppercase' }}>{title}</div>
      {children}
    </div>
  )
}

const ghostBtn = { padding: '8px 14px', borderRadius: 6, background: 'transparent', border: `1px solid ${C.border}`, color: C.textDim, cursor: 'pointer', fontFamily: 'DM Sans', fontSize: 12 }
const primaryBtn = { padding: '8px 16px', borderRadius: 6, background: C.amber, border: 'none', color: '#070A0D', cursor: 'pointer', fontFamily: 'DM Sans', fontSize: 12, fontWeight: 700 }
