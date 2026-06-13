const CFG = {
  active:   { bg: 'rgba(52,211,153,.1)',   color: '#34D399', label: 'Active'   },
  draft:    { bg: 'rgba(245,158,11,.1)',   color: '#F59E0B', label: 'Draft'    },
  complete: { bg: 'rgba(100,116,139,.1)', color: '#6E84A3', label: 'Complete' },
  HIGH:     { bg: 'rgba(248,113,113,.15)', color: '#F87171', label: 'HIGH'     },
  MEDIUM:   { bg: 'rgba(251,146,60,.15)',  color: '#FB923C', label: 'MEDIUM'   },
  LOW:      { bg: 'rgba(52,211,153,.12)',  color: '#34D399', label: 'LOW'      },
}

export function StatusBadge({ status }) {
  const m = CFG[status] || CFG.draft
  return (
    <span style={{
      background: m.bg,
      color: m.color,
      fontSize: 10,
      fontFamily: 'IBM Plex Mono',
      padding: '2px 8px',
      borderRadius: 20,
      letterSpacing: '.5px',
    }}>
      {m.label || status}
    </span>
  )
}
