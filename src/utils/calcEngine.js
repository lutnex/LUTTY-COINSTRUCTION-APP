/**
 * QS / engineering material calculators — metric internal, structured outputs.
 * Quantity tools only — no invented prices.
 */

export const CEMENT_DENSITY_KG_M3 = 1440
export const CEMENT_BAG_KG = 50
export const DRY_FACTOR_CONCRETE = 1.54
export const DRY_FACTOR_MORTAR = 1.30
export const DEFAULT_MORTAR_PER_M2 = 0.018
export const STANDARD_BAR_LENGTH_M = 12

export const BLOCK_PRESETS = {
  ghana_450x225: { faceLengthM: 0.450, faceHeightM: 0.225, label: 'Ghana/common — 450×225mm face' },
  us_8x16:       { faceLengthM: 0.4064, faceHeightM: 0.2032, label: '8in × 16in block face' },
  us_18x9:       { faceLengthM: 0.4572, faceHeightM: 0.2286, label: '18in × 9in block face' },
}

export const CONCRETE_MIX_PRESETS = {
  '1:2:4':   { cement: 1, sand: 2, aggregate: 4, grade: 'C20', cementGrade: '32.5R' },
  '1:1.5:3': { cement: 1, sand: 1.5, aggregate: 3, grade: 'C25', cementGrade: '32.5R' },
  '1:3:6':   { cement: 1, sand: 3, aggregate: 6, grade: 'C15', cementGrade: '32.5R' },
}

export const PAINT_COVERAGE_PRESETS = {
  emulsion:  { label: 'Emulsion (8–12 m²/L/coat)', coverage: 10 },
  satin:     { label: 'Satin/acrylic (7–10 m²/L/coat)', coverage: 8.5 },
  primer:    { label: 'Primer (8–10 m²/L/coat)', coverage: 9 },
  custom:    { label: 'Custom coverage', coverage: 10 },
}

function r3(n) { return Math.round(n * 1000) / 1000 }
function r2(n) { return Math.round(n * 100) / 100 }
function ceil(n) { return Math.ceil(n) }

function resultShell(id, title, formula, assumptions, steps, sections) {
  return { ok: true, id, title, formula, assumptions, steps, sections }
}

function fail(id, error) {
  return { ok: false, id, error }
}

function mortarMaterials(wetVolumeM3, mixRatio = { cement: 1, sand: 6 }, dryFactor = DRY_FACTOR_MORTAR) {
  const dry = wetVolumeM3 * dryFactor
  const total = mixRatio.cement + mixRatio.sand
  const cementVol = dry * (mixRatio.cement / total)
  const sandVol = dry * (mixRatio.sand / total)
  const cementKg = cementVol * CEMENT_DENSITY_KG_M3
  const bags = ceil(cementKg / CEMENT_BAG_KG)
  return { wetVolumeM3, dryVolumeM3: dry, cementVolM3: cementVol, sandVolM3: sandVol, cementKg, cementBags: bags }
}

/** Block count uses face area only — thickness does NOT affect block count. */
export function calcBlockwork({
  wallLengthM,
  wallHeightM,
  blockFaceLengthM,
  blockFaceHeightM,
  openingsAreaM2 = 0,
  wastagePct = 10,
  mortarJointAllowanceM = 0,
}) {
  if (!wallLengthM || !wallHeightM || !blockFaceLengthM || !blockFaceHeightM) {
    return fail('blockwork', 'Wall dimensions and block face size are required')
  }

  const wallArea = wallLengthM * wallHeightM
  const netArea = Math.max(0, wallArea - (openingsAreaM2 || 0))
  const effectiveFaceL = blockFaceLengthM + (mortarJointAllowanceM || 0)
  const effectiveFaceH = blockFaceHeightM + (mortarJointAllowanceM || 0)
  const blockFaceArea = effectiveFaceL * effectiveFaceH
  const baseBlocks = netArea / blockFaceArea
  const baseBlocksRounded = Math.round(baseBlocks)
  const finalBlocks = ceil(baseBlocks * (1 + wastagePct / 100))
  const wastageBlocks = finalBlocks - baseBlocksRounded

  return resultShell(
    'blockwork',
    'Blockwork',
    'Blocks = ceil( (Wall Area − Openings) / Block Face Area × (1 + Wastage%) )',
    [
      'Block count is based on wall face area only.',
      'Wall thickness affects mortar volume, not the number of blocks on the wall face.',
      mortarJointAllowanceM ? `Mortar joint allowance ${mortarJointAllowanceM * 1000}mm added to block face dimensions.` : 'No mortar joint allowance added to block face.',
      `Wastage: ${wastagePct}%.`,
    ],
    [
      { label: 'Wall area', value: `${r2(wallArea)} m²`, detail: `${r3(wallLengthM)} m × ${r3(wallHeightM)} m` },
      { label: 'Openings deducted', value: `${r2(openingsAreaM2 || 0)} m²` },
      { label: 'Net wall area', value: `${r2(netArea)} m²` },
      { label: 'Block face area', value: `${r4(blockFaceArea)} m²`, detail: `${r3(effectiveFaceL)} m × ${r3(effectiveFaceH)} m` },
      { label: 'Base blocks (before wastage)', value: baseBlocksRounded, detail: `${r2(netArea)} ÷ ${r4(blockFaceArea)} = ${baseBlocks.toFixed(2)}` },
      { label: 'Wastage allowance', value: `${wastagePct}%`, detail: `≈ ${wastageBlocks} blocks` },
      { label: 'Final blocks (purchase)', value: finalBlocks, detail: `ceil(${baseBlocks.toFixed(2)} × ${(1 + wastagePct / 100).toFixed(2)})` },
    ],
    {
      purchase: { blocks: finalBlocks },
      metrics: { wallAreaM2: r2(wallArea), netAreaM2: r2(netArea), baseBlocks: baseBlocksRounded, finalBlocks },
    },
  )
}

function r4(n) { return Math.round(n * 10000) / 10000 }

/** Mortar for block laying — standard QS or detailed volume mode. */
export function calcMortarBlockwork({
  netWallAreaM2,
  wallThicknessM,
  blockFaceLengthM,
  blockFaceHeightM,
  blockThicknessM,
  baseBlockCount,
  mode = 'standard',
  mortarPerM2 = DEFAULT_MORTAR_PER_M2,
  mixRatio = { cement: 1, sand: 6 },
  dryFactor = DRY_FACTOR_MORTAR,
  bagKg = CEMENT_BAG_KG,
  sandTripM3,
  jointThicknessM = 0.01,
}) {
  if (!netWallAreaM2 || !wallThicknessM) {
    return fail('mortar', 'Net wall area and wall thickness are required')
  }

  let wetMortarM3
  let methodNote

  if (mode === 'detailed' && blockFaceLengthM && blockFaceHeightM && blockThicknessM && baseBlockCount) {
    const wallVol = netWallAreaM2 * wallThicknessM
    const blockVol = baseBlockCount * blockFaceLengthM * blockFaceHeightM * blockThicknessM
    wetMortarM3 = Math.max(0, wallVol - blockVol)
    methodNote = `Detailed: wall volume (${r3(wallVol)} m³) − block volume (${r3(blockVol)} m³)`
  } else {
    wetMortarM3 = netWallAreaM2 * mortarPerM2
    methodNote = `Standard QS: ${mortarPerM2} m³ mortar per m² wall area (joint ~${jointThicknessM * 1000}mm)`
  }

  const mat = mortarMaterials(wetMortarM3, mixRatio, dryFactor)
  const sandTrips = sandTripM3 > 0 ? ceil(mat.sandVolM3 / sandTripM3) : null

  return resultShell(
    'mortar',
    'Mortar for Block Laying',
    'Dry mortar = Wet mortar × dry factor; Cement/Sand split by mix ratio; Bags = ceil(kg / bag size)',
    [
      methodNote,
      `Mix ratio ${mixRatio.cement}:${mixRatio.sand} (cement:sand).`,
      `Dry volume factor: ${dryFactor}.`,
      `Cement density: ${CEMENT_DENSITY_KG_M3} kg/m³; bag size: ${bagKg} kg.`,
    ],
    [
      { label: 'Net wall area', value: `${r2(netWallAreaM2)} m²` },
      { label: 'Wall thickness', value: `${r3(wallThicknessM)} m (${(wallThicknessM * 1000).toFixed(0)} mm)` },
      { label: 'Wet mortar volume', value: `${r3(wetMortarM3)} m³` },
      { label: 'Dry mortar volume', value: `${r3(mat.dryVolumeM3)} m³`, detail: `× ${dryFactor}` },
      { label: 'Cement volume', value: `${r3(mat.cementVolM3)} m³` },
      { label: 'Sand volume', value: `${r3(mat.sandVolM3)} m³` },
      { label: 'Cement (kg)', value: r2(mat.cementKg) },
      { label: 'Cement bags (purchase)', value: mat.cementBags, detail: `${bagKg} kg bags, rounded up` },
      ...(sandTrips != null ? [{ label: 'Sand trips (purchase)', value: sandTrips, detail: `${sandTripM3} m³ per trip` }] : []),
    ],
    { purchase: { cementBags: mat.cementBags, sandM3: r3(mat.sandVolM3), sandTrips }, metrics: mat },
  )
}

export function calcConcrete({
  lengthM,
  widthM,
  depthM,
  mixKey = '1:2:4',
  wastagePct = 5,
  dryFactor = DRY_FACTOR_CONCRETE,
  bagKg = CEMENT_BAG_KG,
  aggregateTripM3,
}) {
  if (!lengthM || !widthM || !depthM) return fail('concrete', 'Length, width and depth are required')

  const wetVol = lengthM * widthM * depthM
  const wetWithWaste = wetVol * (1 + wastagePct / 100)
  const dryVol = wetWithWaste * dryFactor
  const mix = CONCRETE_MIX_PRESETS[mixKey] || CONCRETE_MIX_PRESETS['1:2:4']
  const total = mix.cement + mix.sand + mix.aggregate
  const cementVol = dryVol * (mix.cement / total)
  const sandVol = dryVol * (mix.sand / total)
  const aggVol = dryVol * (mix.aggregate / total)
  const cementKg = cementVol * CEMENT_DENSITY_KG_M3
  const bags = ceil(cementKg / bagKg)
  const aggTrips = aggregateTripM3 > 0 ? ceil(aggVol / aggregateTripM3) : null

  return resultShell(
    'concrete',
    'Concrete',
    'Wet vol = L×W×D; Dry vol = Wet × 1.54; Materials split by mix ratio; Bags = ceil(kg/50)',
    [
      `Mix ${mixKey} (${mix.grade}, ${mix.cementGrade}).`,
      `Dry volume factor: ${dryFactor}.`,
      `Wastage: ${wastagePct}%.`,
      `Cement density: ${CEMENT_DENSITY_KG_M3} kg/m³.`,
    ],
    [
      { label: 'Wet volume (base)', value: `${r3(wetVol)} m³` },
      { label: 'Wastage', value: `${wastagePct}%`, detail: `${r3(wetWithWaste - wetVol)} m³` },
      { label: 'Wet volume (with wastage)', value: `${r3(wetWithWaste)} m³` },
      { label: 'Dry volume', value: `${r3(dryVol)} m³`, detail: `× ${dryFactor}` },
      { label: 'Cement bags (purchase)', value: bags },
      { label: 'Sand (m³)', value: r3(sandVol) },
      { label: 'Chippings/aggregate (m³)', value: r3(aggVol) },
      ...(aggTrips != null ? [{ label: 'Aggregate trips', value: aggTrips }] : []),
    ],
    { purchase: { cementBags: bags, sandM3: r3(sandVol), aggregateM3: r3(aggVol) }, metrics: { wetVolM3: r3(wetVol), dryVolM3: r3(dryVol) } },
  )
}

export function calcPlaster({
  wallLengthM,
  wallHeightM,
  sides = 1,
  openingsAreaM2 = 0,
  thicknessM = 0.012,
  mixRatio = { cement: 1, sand: 4 },
  wastagePct = 10,
  dryFactor = DRY_FACTOR_MORTAR,
  bagKg = CEMENT_BAG_KG,
}) {
  if (!wallLengthM || !wallHeightM || !thicknessM) return fail('plaster', 'Wall dimensions and thickness are required')

  const grossArea = wallLengthM * wallHeightM * sides
  const netArea = Math.max(0, grossArea - (openingsAreaM2 || 0))
  const wetVol = netArea * thicknessM
  const wetWithWaste = wetVol * (1 + wastagePct / 100)
  const mat = mortarMaterials(wetWithWaste, mixRatio, dryFactor)

  return resultShell(
    'plaster',
    'Plaster / Render',
    'Plaster area = (L×H×sides) − openings; Wet vol = area × thickness; Dry = wet × 1.30',
    [
      `Plaster thickness: ${(thicknessM * 1000).toFixed(0)} mm.`,
      `Sides plastered: ${sides}.`,
      `Mix ${mixRatio.cement}:${mixRatio.sand}.`,
      `Wastage: ${wastagePct}%.`,
    ],
    [
      { label: 'Gross plaster area', value: `${r2(grossArea)} m²` },
      { label: 'Openings deducted', value: `${r2(openingsAreaM2 || 0)} m²` },
      { label: 'Net plaster area', value: `${r2(netArea)} m²` },
      { label: 'Wet mortar (base)', value: `${r3(wetVol)} m³` },
      { label: 'Wet mortar (with wastage)', value: `${r3(wetWithWaste)} m³` },
      { label: 'Cement bags (purchase)', value: mat.cementBags },
      { label: 'Sand (m³)', value: r3(mat.sandVolM3) },
    ],
    { purchase: { cementBags: mat.cementBags, sandM3: r3(mat.sandVolM3) }, metrics: { netAreaM2: r2(netArea) } },
  )
}

/** Reinforcement — unit weight kg/m = d² / 162 (plain bar formula). */
export function calcReinforcement({
  barDiameterMm,
  barLengthM,
  barCount,
  spacingMm,
  memberLengthM,
  lapAllowanceM = 0,
  wastagePct = 5,
}) {
  const d = parseInt(barDiameterMm, 10)
  if (!d) return fail('reinforcement', 'Bar diameter is required')

  const unitWeight = (d * d) / 162
  let totalLengthM
  let lengthNote

  if (spacingMm > 0 && memberLengthM > 0) {
    const count = ceil(memberLengthM / (spacingMm / 1000)) + 1
    totalLengthM = count * (barLengthM || memberLengthM) + count * lapAllowanceM
    lengthNote = `${count} bars @ ${spacingMm}mm c/c over ${memberLengthM}m`
  } else {
    const n = parseInt(barCount, 10) || 0
    if (!n || !barLengthM) return fail('reinforcement', 'Bar length and count required (or use spacing mode)')
    totalLengthM = n * barLengthM + n * lapAllowanceM
    lengthNote = `${n} bars × ${barLengthM}m`
  }

  const baseWeight = unitWeight * totalLengthM
  const finalWeight = baseWeight * (1 + wastagePct / 100)
  const bars12m = ceil(totalLengthM / STANDARD_BAR_LENGTH_M)

  return resultShell(
    'reinforcement',
    'Reinforcement',
    'Unit weight (kg/m) = d² / 162; Total weight = unit weight × total length × (1 + wastage%)',
    [
      `Bar diameter Y${d} mm.`,
      `Lap allowance: ${lapAllowanceM} m per bar.`,
      `Wastage: ${wastagePct}%.`,
      'Binding wire not included unless specified separately.',
    ],
    [
      { label: 'Unit weight', value: `${unitWeight.toFixed(3)} kg/m`, detail: `${d}² / 162 = ${(d * d / 162).toFixed(3)}` },
      { label: 'Total bar length', value: `${r2(totalLengthM)} m`, detail: lengthNote },
      { label: 'Base weight', value: `${r2(baseWeight)} kg` },
      { label: 'Wastage', value: `${wastagePct}%`, detail: `${r2(finalWeight - baseWeight)} kg` },
      { label: 'Final weight (purchase)', value: `${r2(finalWeight)} kg`, detail: `${r3(finalWeight / 1000)} tonnes` },
      { label: '12m bars (purchase)', value: bars12m, detail: `ceil(${totalLengthM.toFixed(2)} / 12)` },
    ],
    { purchase: { weightKg: r2(finalWeight), bars12m }, metrics: { unitWeightKgM: unitWeight, totalLengthM: r2(totalLengthM) } },
  )
}

export function calcTiles({
  lengthM,
  widthM,
  manualAreaM2,
  tileLengthM,
  tileWidthM,
  openingsAreaM2 = 0,
  wastagePct = 10,
  piecesPerBox = 5,
  boxCoverageM2,
}) {
  const area = manualAreaM2 > 0 ? manualAreaM2 : (lengthM && widthM ? lengthM * widthM : 0)
  if (!area || !tileLengthM || !tileWidthM) return fail('tiles', 'Area and tile size are required')

  const netArea = Math.max(0, area - (openingsAreaM2 || 0))
  const tileArea = tileLengthM * tileWidthM
  const baseTiles = netArea / tileArea
  const finalTiles = ceil(baseTiles * (1 + wastagePct / 100))
  const wastageTiles = finalTiles - ceil(baseTiles)
  const boxes = boxCoverageM2 > 0
    ? ceil(netArea * (1 + wastagePct / 100) / boxCoverageM2)
    : ceil(finalTiles / (piecesPerBox || 1))

  return resultShell(
    'tiles',
    'Tiles',
    'Base tiles = Net Area / Tile Area; Final = ceil(Base × (1 + Wastage%))',
    [
      `Tile size: ${(tileLengthM * 1000).toFixed(0)}×${(tileWidthM * 1000).toFixed(0)} mm (${r4(tileArea)} m² each).`,
      `Wastage: ${wastagePct}%.`,
      piecesPerBox ? `${piecesPerBox} pieces per box.` : '',
    ].filter(Boolean),
    [
      { label: 'Gross area', value: `${r2(area)} m²` },
      { label: 'Openings deducted', value: `${r2(openingsAreaM2 || 0)} m²` },
      { label: 'Net area', value: `${r2(netArea)} m²` },
      { label: 'Tile area', value: `${r4(tileArea)} m²` },
      { label: 'Base tiles', value: ceil(baseTiles), detail: `${r2(netArea)} ÷ ${r4(tileArea)}` },
      { label: 'Wastage tiles', value: wastageTiles, detail: `${wastagePct}%` },
      { label: 'Final tiles (purchase)', value: finalTiles },
      { label: 'Boxes (purchase)', value: boxes },
    ],
    { purchase: { tiles: finalTiles, boxes }, metrics: { netAreaM2: r2(netArea), tileAreaM2: r4(tileArea) } },
  )
}

export function calcPaint({
  wallLengthM,
  wallHeightM,
  manualAreaM2,
  coats = 2,
  openingsAreaM2 = 0,
  coverageM2PerLitre = 10,
  bucketLitres = 5,
  wastagePct = 10,
}) {
  const wallArea = manualAreaM2 > 0 ? manualAreaM2 : (wallLengthM && wallHeightM ? wallLengthM * wallHeightM : 0)
  if (!wallArea || !coverageM2PerLitre) return fail('paint', 'Paint area and coverage are required')

  const netArea = Math.max(0, wallArea - (openingsAreaM2 || 0))
  const effectiveArea = netArea * coats
  const baseLitres = effectiveArea / coverageM2PerLitre
  const finalLitres = baseLitres * (1 + wastagePct / 100)
  const buckets = ceil(finalLitres / (bucketLitres || 1))

  return resultShell(
    'paint',
    'Paint',
    'Effective area = (Wall area − openings) × coats; Litres = Effective / Coverage; Buckets = ceil(L / bucket size)',
    [
      `Coverage: ${coverageM2PerLitre} m²/litre/coat (user-selected).`,
      `Coats: ${coats}.`,
      `Wastage: ${wastagePct}%.`,
      'No prices included — quantity tool only.',
    ],
    [
      { label: 'Paint area (net)', value: `${r2(netArea)} m²` },
      { label: 'Number of coats', value: coats },
      { label: 'Effective area', value: `${r2(effectiveArea)} m²`, detail: `${r2(netArea)} × ${coats}` },
      { label: 'Base litres', value: r2(baseLitres) },
      { label: 'Wastage', value: `${wastagePct}%`, detail: `${r2(finalLitres - baseLitres)} L` },
      { label: 'Final litres (purchase)', value: r2(finalLitres) },
      { label: 'Buckets (purchase)', value: buckets, detail: `${bucketLitres} L buckets, rounded up` },
    ],
    { purchase: { litres: r2(finalLitres), buckets }, metrics: { netAreaM2: r2(netArea) } },
  )
}
