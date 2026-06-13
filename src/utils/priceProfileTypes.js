export const PRICE_CATEGORIES = {
  MATERIAL: 'material',
  LABOUR: 'labour',
  EQUIPMENT: 'equipment',
  TRANSPORT: 'transport',
  SUBCONTRACT: 'subcontract',
  PROVISIONAL: 'provisional',
  CLIENT_SUPPLIED: 'client_supplied',
}

export const PRICE_ITEM_SOURCES = {
  USER_AGREED: 'user_agreed',
  MANUAL: 'manual',
  MARKET_SEARCH: 'market_search',
  AI_SUGGESTED: 'ai_suggested',
}

export const PRICING_SOURCE_MODES = {
  PROFILE: 'profile',
  LIVE: 'live',
  COMPARE: 'compare',
  MANUAL: 'manual',
}

export const PRICING_SOURCE_OPTIONS = [
  { id: PRICING_SOURCE_MODES.PROFILE, label: 'A. Use saved Price Profile rates', desc: 'Apply rates from your selected profile only. No silent market substitution.' },
  { id: PRICING_SOURCE_MODES.LIVE, label: 'B. Use live market/internet prices', desc: 'Search supplier/market data. Profile rates are not applied unless you confirm.' },
  { id: PRICING_SOURCE_MODES.COMPARE, label: 'C. Compare both — choose item by item', desc: 'Show profile vs live market for each material. You pick per item.' },
  { id: PRICING_SOURCE_MODES.MANUAL, label: 'D. Manual prices I will provide now', desc: 'Enter rates yourself. AI will not apply saved or market rates.' },
]

export const CATEGORY_LABELS = {
  [PRICE_CATEGORIES.MATERIAL]: 'Material',
  [PRICE_CATEGORIES.LABOUR]: 'Labour',
  [PRICE_CATEGORIES.EQUIPMENT]: 'Equipment',
  [PRICE_CATEGORIES.TRANSPORT]: 'Transport',
  [PRICE_CATEGORIES.SUBCONTRACT]: 'Subcontract',
  [PRICE_CATEGORIES.PROVISIONAL]: 'Provisional',
  [PRICE_CATEGORIES.CLIENT_SUPPLIED]: 'Client-supplied',
}

export const SOURCE_LABELS = {
  [PRICE_ITEM_SOURCES.USER_AGREED]: 'User Agreed',
  [PRICE_ITEM_SOURCES.MANUAL]: 'Manual',
  [PRICE_ITEM_SOURCES.MARKET_SEARCH]: 'Market Search',
  [PRICE_ITEM_SOURCES.AI_SUGGESTED]: 'AI Suggested',
}
