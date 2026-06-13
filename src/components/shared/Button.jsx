import { Spinner } from './Spinner.jsx'

const VARIANTS = {
  primary: { background: '#F59E0B', color: '#070A0D', border: 'none' },
  outline: { background: 'transparent', color: '#6E84A3', border: '1px solid #253040' },
  sky:     { background: 'transparent', color: '#38BDF8', border: '1px solid #38BDF8' },
  green:   { background: 'transparent', color: '#34D399', border: '1px solid #34D399' },
  red:     { background: 'transparent', color: '#F87171', border: '1px solid rgba(248,113,113,.3)' },
  ghost:   { background: 'transparent', color: '#6E84A3', border: 'none' },
  amber:   { background: 'transparent', color: '#F59E0B', border: '1px solid rgba(245,158,11,.4)' },
}

export function Button({ children, variant = 'primary', size = 'md', loading = false, disabled = false, onClick, style = {}, title }) {
  const v = VARIANTS[variant] || VARIANTS.primary
  const pad = size === 'sm' ? '5px 10px' : size === 'lg' ? '10px 20px' : '7px 15px'
  const fs  = size === 'sm' ? 11.5 : size === 'lg' ? 14 : 12.5

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
      style={{
        ...v,
        padding: pad,
        borderRadius: 6,
        fontSize: fs,
        fontWeight: 600,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        fontFamily: 'DM Sans',
        transition: 'all .15s',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        opacity: disabled || loading ? 0.5 : 1,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {loading && <Spinner size={11} />}
      {children}
    </button>
  )
}
