export function priceProfileItemToRow(item, profile) {
  return {
    id: String(item.id),
    profile_id: profile.id,
    profile_name: profile.name,
    material_name: item.material,
    specification: item.specification || '',
    unit: item.unit || '',
    price: item.price ? parseFloat(item.price) : null,
    currency: item.currency || 'GHS',
    category: item.category || 'material',
    supplier: item.supplier || '',
    supplier_url: item.supplierUrl || '',
    location: item.location || '',
    source: item.source || 'manual',
    notes: item.notes || '',
    history: item.history || [],
    updated_at: new Date().toISOString(),
  }
}

export function rowToPriceProfileItem(row) {
  if (!row) return null
  return {
    id: row.id,
    material: row.material_name,
    specification: row.specification || '',
    unit: row.unit || '',
    price: row.price != null ? String(row.price) : '',
    currency: row.currency || 'GHS',
    category: row.category || 'material',
    supplier: row.supplier || '',
    supplierUrl: row.supplier_url || '',
    location: row.location || '',
    source: row.source || 'manual',
    notes: row.notes || '',
    lastUpdated: row.updated_at ? row.updated_at.slice(0, 10) : null,
    history: row.history || [],
  }
}

export function profileToRow(profile) {
  return {
    id: profile.id,
    name: profile.name,
    is_active: Boolean(profile.isActive),
    created_at: profile.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

export function rowToProfile(row, items = []) {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at?.slice?.(0, 10) || '',
    updatedAt: row.updated_at?.slice?.(0, 10) || '',
    items,
  }
}
