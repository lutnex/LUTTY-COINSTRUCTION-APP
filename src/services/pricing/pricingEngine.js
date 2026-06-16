/**

 * Transparent pricing engine — direct costs only by default.

 *

 * Materials + Labour + Equipment + explicit prelim lines = PROJECT SUBTOTAL

 * Manual financial adjustments (optional, user-enabled) = FINAL CONTRACT SUM

 */



import {

  applyFinancialAdjustments,

  FINANCIAL_ITEM_META,

  createDefaultFinancialAdjustments,

} from '../../utils/financialAdjustments.js'



export function sumRowAmounts(rows = [], { excludeClientSupply = true } = {}) {

  return rows.reduce((s, r) => {

    if (excludeClientSupply && (r.clientSupplied || r.clientSupply)) return s

    return s + (parseFloat(r.amount) || 0)

  }, 0)

}



/**

 * @param {object} input

 * @param {Array} input.boqRows

 * @param {Array} [input.materials]

 * @param {Array} [input.labor]

 * @param {Array} [input.equipment]

 * @param {Array} [input.prelims] — explicit direct-cost prelim lines only

 * @param {object} [input.financialAdjustments] — manual commercial adjustments

 */

export function computePricing(input = {}) {

  const {

    boqRows = [],

    materials = [],

    labor = [],

    equipment = [],

    prelims = [],

    financialAdjustments: rawAdjustments,

  } = input



  const financialAdjustments = rawAdjustments && typeof rawAdjustments === 'object'

    ? rawAdjustments

    : createDefaultFinancialAdjustments()



  const boqWorks = sumRowAmounts(boqRows)

  const matWorks = materials.length ? sumRowAmounts(materials) : 0

  const labWorks = sumRowAmounts(labor, { excludeClientSupply: false })

  const equipWorks = sumRowAmounts(equipment, { excludeClientSupply: false })



  const rawWorks = boqWorks > 0 ? boqWorks : matWorks

  const directPrelims = (prelims || []).filter(p => !p.isFinancialAdjustment)

  const prelimExplicit = directPrelims.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)



  const projectSubtotal = rawWorks + labWorks + equipWorks + prelimExplicit



  const adjustmentResult = applyFinancialAdjustments(projectSubtotal, financialAdjustments)

  const finalEstimate = adjustmentResult.finalTotal



  const audit = [

    rawWorks > 0 && { layer: 'Materials / BOQ Works', amount: rawWorks },

    labWorks > 0 && { layer: 'Labour', amount: labWorks },

    equipWorks > 0 && { layer: 'Equipment', amount: equipWorks },

    prelimExplicit > 0 && { layer: 'Preliminaries (direct)', amount: prelimExplicit },

    { layer: 'PROJECT SUBTOTAL', amount: projectSubtotal, bold: false, emphasis: true },

    ...adjustmentResult.enabledLines.map(line => ({

      layer: line.isDeduction ? `− ${line.label}` : `+ ${line.label}`,

      amount: line.amount,

      signed: line.signed,

      isDeduction: line.isDeduction,

      adjustmentId: line.id,

    })),

    { layer: 'FINAL CONTRACT SUM', amount: finalEstimate, bold: true },

  ].filter(Boolean)



  const layers = {

    rawWorks,

    materials: matWorks,

    labour: labWorks,

    equipment: equipWorks,

    prelimExplicit,

    projectSubtotal,

    adjustments: adjustmentResult.lines,

    finalEstimate,

  }



  const summary = {

    sub: rawWorks,

    mat: matWorks,

    boq: boqWorks,

    labour: labWorks,

    equipment: equipWorks,

    prelims: prelimExplicit,

    projectSubtotal,

    cont: adjustmentResult.lines.find(l => l.id === 'contingency')?.amount || 0,

    oh: adjustmentResult.lines.find(l => l.id === 'overheads')?.amount || 0,

    profit: adjustmentResult.lines.find(l => l.id === 'profit')?.amount || 0,

    vat: adjustmentResult.lines.find(l => l.id === 'vat')?.amount || 0,

    discount: adjustmentResult.lines.find(l => l.id === 'discount')?.amount || 0,

    grand: finalEstimate,

    works: rawWorks,

  }



  return {

    mode: 'manual',

    rawWorks,

    directCost: projectSubtotal,

    lineItemsTotal: projectSubtotal,

    layers,

    summary,

    audit,

    adjustmentResult,

    prelimsForDoc: directPrelims,

  }

}



/** BOQ builder footer totals — direct costs + optional manual adjustments. */

export function computeBoqBuilderTotals(rows, options = {}) {

  return computePricing({ boqRows: rows, ...options }).summary

}



export function buildCommercialAuditLabels() {

  return Object.entries(FINANCIAL_ITEM_META).map(([id, m]) => m.label)

}


