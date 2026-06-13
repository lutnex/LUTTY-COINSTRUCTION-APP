import { useMemo, useState } from 'react'
import { C } from '../../utils/constants.js'
import { getMarketCatalogByCategory } from '../../data/materialMarketCatalog.js'
import { loadPriceProfiles, savePriceProfiles } from '../../utils/priceStore.js'

export default function MarketTrendsPage({ prices = [], onPricesChange }) {
  const [localPrices, setLocalPrices] = useState(() => prices.length ? prices : loadPriceProfiles())
  const [filter, setFilter] = useState('')

  const catalog = useMemo(() => getMarketCatalogByCategory(), [])
  const filtered = catalog
    .map(g => ({
      ...g,
      items: g.items.filter(i =>
        !filter || i.name.toLowerCase().includes(filter.toLowerCase()) || i.category.toLowerCase().includes(filter.toLowerCase()),
      ),
    }))
    .filter(g => g.items.length)

  const saveManualPrice = (itemId, field, value) => {
    const item = catalog.flatMap(g => g.items).find(i => i.id === itemId)
    if (!item) return
    const existing = localPrices.find(p => p.material === item.name && p.specification === item.specification)
    const next = existing
      ? localPrices.map(p => p.id === existing.id ? { ...p, [field]: value, lastUpdated: new Date().toISOString().slice(0, 10), source: 'user' } : p)
      : [...localPrices, {
        id: Date.now(),
        material: item.name,
        specification: item.specification,
        unit: item.unit,
        price: field === 'price' ? value : '',
        supplier: field === 'supplier' ? value : '',
        location: field === 'location' ? value : '',
        lastUpdated: new Date().toISOString().slice(0, 10),
        source: 'user',
      }]
    setLocalPrices(next)
    savePriceProfiles(next)
    onPricesChange?.(next)
  }

  const lookupPrice = (item) => localPrices.find(p => p.material === item.name && (!item.specification || p.specification === item.specification))

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
      <div style={{ fontFamily: "'Bebas Neue'", fontSize: 25, letterSpacing: 2, color: C.amber, marginBottom: 3 }}>MATERIAL MARKET TRENDS</div>
      <div style={{ fontSize: 12.5, color: C.textDim, marginBottom: 16, maxWidth: 720, lineHeight: 1.6 }}>
        Local supplier building material prices. Where live supplier data is not available, enter prices manually — the app never invents market rates.
      </div>

      <input
        value={filter}
        onChange={e => setFilter(e.target.value)}
        placeholder="Filter materials or categories…"
        style={{ width: '100%', maxWidth: 420, marginBottom: 18, background: C.slate, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, padding: '10px 12px' }}
      />

      {filtered.map(group => (
        <div key={group.category} style={{ marginBottom: 22 }}>
          <div style={{ fontFamily: "'IBM Plex Mono'", fontSize: 11, color: C.amber, letterSpacing: 1.5, marginBottom: 8 }}>{group.category.toUpperCase()}</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  {['Material', 'Specification', 'Price (GHS)', 'Unit', 'Supplier', 'Location', 'Last checked', 'Status'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '7px 9px', borderBottom: `1px solid ${C.border}`, color: C.amber, fontFamily: "'IBM Plex Mono'", fontSize: 10 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {group.items.map(item => {
                  const saved = lookupPrice(item)
                  const live = saved?.price
                  return (
                    <tr key={item.id}>
                      <td style={cell()}>{item.name}</td>
                      <td style={cell()}>{item.specification}</td>
                      <td style={cell()}>
                        <input
                          value={saved?.price || ''}
                          onChange={e => saveManualPrice(item.id, 'price', e.target.value)}
                          placeholder="Manual entry required"
                          style={inp()}
                        />
                      </td>
                      <td style={cell()}>{item.unit}</td>
                      <td style={cell()}>
                        <input value={saved?.supplier || ''} onChange={e => saveManualPrice(item.id, 'supplier', e.target.value)} placeholder="Supplier" style={inp()} />
                      </td>
                      <td style={cell()}>
                        <input value={saved?.location || ''} onChange={e => saveManualPrice(item.id, 'location', e.target.value)} placeholder="Location" style={inp()} />
                      </td>
                      <td style={{ ...cell(), fontFamily: "'IBM Plex Mono'", fontSize: 11, color: C.textFaint }}>
                        {saved?.lastUpdated || item.lastChecked || '—'}
                      </td>
                      <td style={cell()}>
                        <span style={{
                          fontSize: 10, padding: '2px 8px', borderRadius: 12,
                          background: live ? 'rgba(52,211,153,.12)' : 'rgba(248,113,113,.12)',
                          color: live ? '#34D399' : '#F87171',
                          border: `1px solid ${live ? 'rgba(52,211,153,.3)' : 'rgba(248,113,113,.3)'}`,
                        }}>
                          {live ? 'User price saved' : 'Manual entry required'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}

function cell() { return { padding: '7px 9px', borderBottom: `1px solid ${C.border}`, color: C.text } }
function inp() { return { width: '100%', minWidth: 90, background: C.slate, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, padding: '5px 8px', fontSize: 12 } }
