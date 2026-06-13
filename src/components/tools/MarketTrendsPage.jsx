import { useMemo, useState, useEffect } from 'react'
import { C } from '../../utils/constants.js'
import { getMarketCatalogByCategory } from '../../data/materialMarketCatalog.js'
import { loadPriceProfiles, savePriceProfiles } from '../../utils/priceStore.js'
import { fetchMaterialPrices, searchLiveMaterialPrices, livePriceToProfile } from '../../services/materialPricesService.js'

export default function MarketTrendsPage({ prices = [], onPricesChange }) {
  const [localPrices, setLocalPrices] = useState(() => prices.length ? prices : loadPriceProfiles())
  const [livePrices, setLivePrices] = useState([])
  const [filter, setFilter] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchMsg, setSearchMsg] = useState('')

  const catalog = useMemo(() => getMarketCatalogByCategory(), [])

  useEffect(() => {
    fetchMaterialPrices().then(({ prices: cached }) => {
      if (cached?.length) setLivePrices(cached)
    })
  }, [])

  const mergedByKey = useMemo(() => {
    const map = new Map()
    for (const p of livePrices) {
      if (p.materialKey) map.set(p.materialKey, p)
    }
    return map
  }, [livePrices])

  const filtered = catalog
    .map(g => ({
      ...g,
      items: g.items.filter(i =>
        !filter || i.name.toLowerCase().includes(filter.toLowerCase()) || i.category.toLowerCase().includes(filter.toLowerCase()),
      ),
    }))
    .filter(g => g.items.length)

  const saveManualPrice = (item, field, value) => {
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
        supplierUrl: field === 'supplierUrl' ? value : '',
        lastUpdated: new Date().toISOString().slice(0, 10),
        source: 'user',
      }]
    setLocalPrices(next)
    savePriceProfiles(next)
    onPricesChange?.(next)
  }

  const lookupManual = (item) => localPrices.find(p => p.material === item.name && p.specification === item.specification)
  const lookupLive = (item) => {
    const key = item.id
    for (const [, p] of mergedByKey) {
      if (p.materialName === item.name || p.materialKey === key) return p
    }
    return null
  }

  const handleSearchLive = async () => {
    setSearching(true)
    setSearchMsg('Searching Ghana supplier listings…')
    const result = await searchLiveMaterialPrices({ refresh: true })
    setSearching(false)
    if (result.prices?.length) {
      setLivePrices(result.prices)
      const profiles = result.prices.map(livePriceToProfile).filter(Boolean)
      if (profiles.length) {
        const next = [...localPrices]
        for (const p of profiles) {
          const idx = next.findIndex(x => x.material === p.material && x.specification === p.specification)
          if (idx >= 0) next[idx] = { ...next[idx], ...p, source: 'live' }
          else next.push(p)
        }
        setLocalPrices(next)
        savePriceProfiles(next)
        onPricesChange?.(next)
      }
    }
    setSearchMsg(result.ok
      ? `Found ${result.live} live price(s). ${result.manual} need manual entry.`
      : (result.errors?.[0] || 'Search completed with no live prices — manual entry required.'))
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 25, letterSpacing: 2, color: C.amber, marginBottom: 3 }}>MATERIAL MARKET TRENDS</div>
          <div style={{ fontSize: 12.5, color: C.textDim, maxWidth: 720, lineHeight: 1.6 }}>
            Server-side supplier search for Ghana building materials. Prices are never invented — only parsed from supplier pages or entered by you.
          </div>
        </div>
        <button onClick={handleSearchLive} disabled={searching} style={{
          background: C.amber, color: '#070A0D', border: 'none', borderRadius: 8, padding: '10px 16px',
          fontWeight: 700, cursor: searching ? 'not-allowed' : 'pointer', opacity: searching ? 0.7 : 1,
        }}>
          {searching ? 'Searching…' : 'Search Live Prices'}
        </button>
      </div>
      {searchMsg && <div style={{ fontSize: 12, color: C.textDim, marginBottom: 14 }}>{searchMsg}</div>}

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
                  {['Material', 'Specification', 'Price (GHS)', 'Unit', 'Supplier', 'Link', 'Location', 'Last checked', 'Status'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '7px 9px', borderBottom: `1px solid ${C.border}`, color: C.amber, fontFamily: "'IBM Plex Mono'", fontSize: 10 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {group.items.map(item => {
                  const manual = lookupManual(item)
                  const live = lookupLive(item)
                  const displayPrice = manual?.price || (live?.price != null ? String(live.price) : '')
                  const status = manual?.price ? 'user_override' : live?.status === 'live' ? 'live' : 'manual_entry_required'
                  return (
                    <tr key={item.id}>
                      <td style={cell()}>{item.name}</td>
                      <td style={cell()}>{item.specification}</td>
                      <td style={cell()}>
                        <input
                          value={displayPrice}
                          onChange={e => saveManualPrice(item, 'price', e.target.value)}
                          placeholder={status === 'live' ? String(live.price) : 'Manual entry required'}
                          style={inp()}
                        />
                      </td>
                      <td style={cell()}>{item.unit}</td>
                      <td style={cell()}>
                        <input value={manual?.supplier || live?.supplier || ''} onChange={e => saveManualPrice(item, 'supplier', e.target.value)} placeholder="Supplier" style={inp()} />
                      </td>
                      <td style={cell()}>
                        {(manual?.supplierUrl || live?.supplierUrl) ? (
                          <a href={manual?.supplierUrl || live?.supplierUrl} target="_blank" rel="noreferrer" style={{ color: C.sky, fontSize: 11 }}>View</a>
                        ) : '—'}
                      </td>
                      <td style={cell()}>
                        <input value={manual?.location || live?.location || ''} onChange={e => saveManualPrice(item, 'location', e.target.value)} placeholder="Ghana" style={inp()} />
                      </td>
                      <td style={{ ...cell(), fontFamily: "'IBM Plex Mono'", fontSize: 11, color: C.textFaint }}>
                        {manual?.lastUpdated || live?.checkedAt?.slice?.(0, 10) || '—'}
                      </td>
                      <td style={cell()}>
                        <StatusBadge status={status} />
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

function StatusBadge({ status }) {
  const map = {
    live: { bg: 'rgba(52,211,153,.12)', color: '#34D399', border: 'rgba(52,211,153,.3)', label: 'Live supplier price' },
    user_override: { bg: 'rgba(56,189,248,.12)', color: '#38BDF8', border: 'rgba(56,189,248,.3)', label: 'User price saved' },
    manual_entry_required: { bg: 'rgba(248,113,113,.12)', color: '#F87171', border: 'rgba(248,113,113,.3)', label: 'Manual entry required' },
  }
  const s = map[status] || map.manual_entry_required
  return (
    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 12, background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {s.label}
    </span>
  )
}

function cell() { return { padding: '7px 9px', borderBottom: `1px solid ${C.border}`, color: C.text } }
function inp() { return { width: '100%', minWidth: 90, background: C.slate, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, padding: '5px 8px', fontSize: 12 } }
