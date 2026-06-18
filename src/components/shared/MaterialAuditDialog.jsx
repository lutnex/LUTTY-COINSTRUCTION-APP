import { C } from '../../utils/constants.js'
import { Button } from './Button.jsx'
import { fmtN } from '../../utils/formatters.js'

const FLAG_STYLES = {
  extra: { bg: 'rgba(220,80,60,.15)', border: 'rgba(220,80,60,.4)', label: 'EXTRA' },
  duplicate: { bg: 'rgba(220,140,60,.15)', border: 'rgba(220,140,60,.4)', label: 'DUPLICATE' },
  modified: { bg: 'rgba(220,180,60,.12)', border: 'rgba(220,180,60,.35)', label: 'MODIFIED' },
  stale: { bg: 'rgba(160,100,220,.12)', border: 'rgba(160,100,220,.35)', label: 'STALE' },
  missing: { bg: 'rgba(100,140,220,.12)', border: 'rgba(100,140,220,.35)', label: 'MISSING' },
}

function RowFlags({ flags = [] }) {
  if (!flags.length) return null
  return (
    <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>
      {flags.map(f => {
        const style = FLAG_STYLES[f] || FLAG_STYLES.extra
        return (
          <span
            key={f}
            style={{
              fontSize: 9, fontWeight: 700, letterSpacing: 0.5,
              padding: '2px 5px', borderRadius: 4,
              background: style.bg, border: `1px solid ${style.border}`, color: C.textDim,
            }}
          >
            {style.label}
          </span>
        )
      })}
    </span>
  )
}

export default function MaterialAuditDialog({ open, onClose, audit = null }) {
  if (!open || !audit) return null

  const showAll = audit.rows || []
  const highlighted = audit.flaggedRows?.length ? audit.flaggedRows : showAll
  const diffColor = Math.abs(audit.difference) > 0.02 ? '#F0A090' : C.amber

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(7,10,13,.88)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200,
    }}>
      <div style={{
        background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12,
        padding: 24, width: 900, maxWidth: '96vw', maxHeight: '92vh', overflowY: 'auto',
      }}>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 22, color: C.amber, letterSpacing: '1.5px', marginBottom: 4 }}>
          Material Audit
        </div>
        <div style={{ fontSize: 12, color: C.textDim, marginBottom: 14 }}>
          Compare material schedule rows against the imported estimate baseline.
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14,
        }}>
          {[
            ['Expected Material Total', audit.expectedTotal, C.textDim],
            ['Actual Material Total', audit.actualTotal, C.text],
            ['Difference', audit.difference, diffColor],
          ].map(([label, value, color]) => (
            <div key={label} style={{
              background: C.carbon, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px',
            }}>
              <div style={{ fontSize: 10, color: C.textFaint, marginBottom: 4 }}>{label}</div>
              <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 15, color, fontWeight: 600 }}>
                GHS {fmtN(value)}
              </div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 11, color: C.textFaint, marginBottom: 12 }}>
          Expected origin: {audit.expectedOrigin}
          {!audit.hasBaseline && (
            <span style={{ color: '#F0A090', marginLeft: 8 }}>
              — No stored baseline; using latest chat extract if available
            </span>
          )}
        </div>

        {Math.abs(audit.difference) > 0.02 && (
          <div style={{
            background: 'rgba(220,80,60,.1)', border: '1px solid rgba(220,80,60,.3)',
            borderRadius: 8, padding: '10px 12px', marginBottom: 14, fontSize: 11, color: '#F0A090',
          }}>
            Flagged rows account for GHS {fmtN(audit.flaggedDeltaSum)} of the GHS {fmtN(audit.difference)} difference.
            {audit.summary.duplicate > 0 && ` ${audit.summary.duplicate} duplicate row(s).`}
            {audit.summary.stale > 0 && ` ${audit.summary.stale} possible stale row(s).`}
          </div>
        )}

        {audit.watchSummary?.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: C.textFaint, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
              Watch Groups
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {audit.watchSummary.map(g => (
                <span key={g.id} style={{
                  fontSize: 10, padding: '4px 8px', borderRadius: 12,
                  background: C.carbon, border: `1px solid ${C.border}`, color: C.textDim,
                }}>
                  {g.label}: {g.rowCount} issue{g.rowCount !== 1 ? 's' : ''} (GHS {fmtN(g.delta)})
                </span>
              ))}
            </div>
          </div>
        )}

        <div style={{
          background: C.carbon, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden', marginBottom: 16,
        }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '2fr 70px 80px 90px 1fr 120px',
            gap: 8, padding: '10px 12px', borderBottom: `1px solid ${C.border}`,
            fontSize: 10, color: C.textFaint, fontWeight: 600, textTransform: 'uppercase',
          }}>
            <div>Item</div>
            <div style={{ textAlign: 'right' }}>Qty</div>
            <div style={{ textAlign: 'right' }}>Rate</div>
            <div style={{ textAlign: 'right' }}>Amount</div>
            <div>Source</div>
            <div>Flags</div>
          </div>
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {(highlighted.length ? highlighted : showAll).map(row => {
              const highlighted = row.flags.length > 0
              const primaryFlag = row.flags[0]
              const style = highlighted ? (FLAG_STYLES[primaryFlag] || FLAG_STYLES.extra) : null
              return (
                <div
                  key={row.id}
                  style={{
                    display: 'grid', gridTemplateColumns: '2fr 70px 80px 90px 1fr 120px',
                    gap: 8, padding: '8px 12px', alignItems: 'center',
                    borderBottom: `1px solid ${C.border}`,
                    background: style ? style.bg : 'transparent',
                    fontSize: 11,
                  }}
                >
                  <div style={{ color: C.text }}>
                    {row.item}
                    {row.expectedAmount != null && row.flags.includes('modified') && (
                      <div style={{ fontSize: 10, color: C.textFaint, marginTop: 2 }}>
                        Expected: GHS {fmtN(row.expectedAmount)}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono'", color: C.textDim }}>{row.qty || '—'}</div>
                  <div style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono'", color: C.textDim }}>{row.rate || '—'}</div>
                  <div style={{ textAlign: 'right', fontFamily: "'IBM Plex Mono'", color: highlighted ? diffColor : C.text }}>
                    GHS {fmtN(row.amount)}
                    {Math.abs(row.delta) > 0.02 && (
                      <div style={{ fontSize: 9, color: diffColor }}>
                        {row.delta > 0 ? '+' : ''}{fmtN(row.delta)}
                      </div>
                    )}
                  </div>
                  <div style={{ color: C.textFaint, fontSize: 10 }}>{row.source}</div>
                  <div><RowFlags flags={row.flags} /></div>
                </div>
              )
            })}
            {!showAll.length && (
              <div style={{ padding: 16, textAlign: 'center', color: C.textFaint, fontSize: 12 }}>
                No material rows in the current schedule.
              </div>
            )}
          </div>
        </div>

        <div style={{ fontSize: 10, color: C.textFaint, marginBottom: 14 }}>
          Material Total = Sum(material row amounts) = GHS {fmtN(audit.actualTotal)}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  )
}
