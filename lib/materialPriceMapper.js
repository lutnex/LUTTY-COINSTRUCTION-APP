export function rowToMaterialPrice(row) {
  if (!row) return null
  return {
    id: row.id,
    materialKey: row.material_key,
    materialName: row.material_name,
    specification: row.specification || '',
    price: row.price != null ? Number(row.price) : null,
    unit: row.unit || '',
    supplier: row.supplier || '',
    supplierUrl: row.supplier_url || '',
    location: row.location || 'Ghana',
    source: row.source || 'manual',
    status: row.status || 'manual_entry_required',
    trend: row.trend || null,
    checkedAt: row.checked_at || row.updated_at || null,
  }
}

export function materialPriceToRow(item) {
  return {
    id: item.id || `${item.materialKey}-${Date.now()}`,
    material_key: item.materialKey,
    material_name: item.materialName,
    specification: item.specification || '',
    price: item.price != null && item.price !== '' ? Number(item.price) : null,
    unit: item.unit || '',
    supplier: item.supplier || '',
    supplier_url: item.supplierUrl || '',
    location: item.location || 'Ghana',
    source: item.source || 'search',
    status: item.status || (item.price ? 'live' : 'manual_entry_required'),
    trend: item.trend || null,
    checked_at: item.checkedAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}
