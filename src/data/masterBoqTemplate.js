/**
 * Master BOQ template — Ghana-standard QS / commercial estimating structure.
 * Serves as the formatting and hierarchy reference for all AI-generated BOQs.
 * Align with uploaded consultant/sample BOQ methodology when present.
 */

export const MASTER_BOQ_META = {
  standard: 'Ghana — SMM-inspired / De-Luteroits Commercial BOQ',
  currency: 'GHS',
  numbering: 'Bill.Section.Item (e.g. 3.01.001)',
  collectionLabel: 'Collection',
  carriedToSummary: 'Carried to Summary',
}

/** Bill order — replicate on every full-scope BOQ unless user excludes trades. */
export const MASTER_BILLS = [
  { id: '1',  code: 'B1',  title: 'PRELIMINARIES & GENERAL REQUIREMENTS',      include: 'always' },
  { id: '2',  code: 'B2',  title: 'EARTHWORKS, EXCAVATION & FILLING',          include: 'always' },
  { id: '3',  code: 'B3',  title: 'SUBSTRUCTURE & FOUNDATIONS',                include: 'always' },
  { id: '4',  code: 'B4',  title: 'REINFORCED CONCRETE WORKS',                 include: 'always' },
  { id: '5',  code: 'B5',  title: 'FORMWORK',                                    include: 'always' },
  { id: '6',  code: 'B6',  title: 'REINFORCEMENT STEEL',                       include: 'always' },
  { id: '7',  code: 'B7',  title: 'MASONRY & BLOCKWORK',                         include: 'always' },
  { id: '8',  code: 'B8',  title: 'ROOFING, FLASHINGS & RAINWATER GOODS',        include: 'always' },
  { id: '9',  code: 'B9',  title: 'CEILINGS & SOFFITS',                          include: 'always' },
  { id: '10', code: 'B10', title: 'DOORS, WINDOWS & IRONMONGERY',                include: 'always' },
  { id: '11', code: 'B11', title: 'GLAZING',                                     include: 'if_visible' },
  { id: '12', code: 'B12', title: 'FLOOR FINISHES — SCREED, TILES & COVERINGS',  include: 'always' },
  { id: '13', code: 'B13', title: 'WALL FINISHES — PLASTER & CLADDING',          include: 'always' },
  { id: '14', code: 'B14', title: 'PAINTING & DECORATING',                       include: 'always' },
  { id: '15', code: 'B15', title: 'WATERPROOFING & DAMP-PROOFING',               include: 'always' },
  { id: '16', code: 'B16', title: 'PLUMBING — FIRST FIX',                        include: 'always' },
  { id: '17', code: 'B17', title: 'PLUMBING — SECOND FIX & SANITARY FIXTURES',   include: 'always' },
  { id: '18', code: 'B18', title: 'ELECTRICAL — FIRST FIX',                      include: 'always' },
  { id: '19', code: 'B19', title: 'ELECTRICAL — SECOND FIX & FITTINGS',          include: 'always' },
  { id: '20', code: 'B20', title: 'HVAC / AIR CONDITIONING PROVISIONS',          include: 'if_visible' },
  { id: '21', code: 'B21', title: 'EXTERNAL WORKS, APRONS, STEPS & PAVING',      include: 'always' },
  { id: '22', code: 'B22', title: 'DRAINAGE, SOAKAWAY & RAINWATER DISPOSAL',   include: 'always' },
  { id: '23', code: 'B23', title: 'TESTING, COMMISSIONING & HANDOVER',           include: 'always' },
  { id: '24', code: 'B24', title: 'PROVISIONAL SUMS & PRIME COST ITEMS',         include: 'always' },
  { id: '25', code: 'B25', title: 'CONTRACTOR PRELIMINARIES, OH&P & CONTINGENCY', include: 'always' },
]

/** Excluded unless user explicitly requests. */
export const OPTIONAL_SCOPE = [
  'Fence wall / perimeter wall',
  'Landscaping & external planting',
  'Joinery / fitted cabinetry (optional upgrade)',
]

/** Full project coverage checklist for drawing takeoff. */
export const FULL_SCOPE_TRADES = [
  'Earthworks', 'Excavation', 'Filling & compaction', 'Anti-termite',
  'Blinding concrete', 'Strip/pad/raft foundations', 'Reinforced concrete',
  'Formwork', 'Reinforcement', 'Blockwork', 'Lintels', 'Roof structure',
  'Roof covering', 'Ridge/hip tiles', 'Flashings', 'Gutters & downpipes',
  'Fascia & soffit', 'Ceiling (GYpsum/POP/suspended)', 'Floor screed',
  'Waterproofing', 'Floor tiles', 'Wall tiles', 'Plastering', 'Painting',
  'Doors', 'Windows', 'Ironmongery', 'Glazing', 'Plumbing 1st fix',
  'Plumbing 2nd fix', 'Sanitary fixtures', 'Electrical 1st fix',
  'Electrical 2nd fix', 'AC provisions', 'External aprons', 'External steps',
  'Surface drainage', 'Testing & commissioning', 'Preliminaries', 'OH&P', 'Contingency',
]

export const WASTAGE_ALLOWANCES = {
  concrete:       '5–8%',
  reinforcement:  '3–5%',
  blocks:         '5–10%',
  tiles:          '10–15%',
  paint:          '10%',
  pipes:          '5%',
  general:        '10–12%',
}

export const COMMERCIAL_STRUCTURE = {
  worksSubtotal:     'Sum of all bill collections — PROJECT SUBTOTAL (direct costs only)',
  provisionalSums:   'PC items + defined provisional sums',
  contingency:       'NEVER auto-add — user applies manually in Financial Adjustments if required',
  transport:         'Itemize in preliminaries or direct costs',
  supervision:       'Site agent / foreman — preliminaries line items',
  overhead:          'NEVER auto-add — user applies manually if required',
  profit:            'NEVER auto-add — commercial decision by contractor only',
  contractSum:       'FINAL CONTRACT SUM — only after user-enabled adjustments',
}

/** Machine-readable table header the parser expects. */
export const BOQ_TABLE_HEADER = '| Item Ref | Section | Description | Unit | Qty | Rate (GHS) | Amount (GHS) |'

export function getBillListForPrompt() {
  return MASTER_BILLS.map(b => `${b.code} — ${b.title}`).join('\n')
}

export function getMasterStructurePrompt() {
  return `
MASTER BOQ STRUCTURE (MANDATORY — replicate this consultant-grade format):

Numbering: ${MASTER_BOQ_META.numbering}
Currency: ${MASTER_BOQ_META.currency}
Collection line after each bill: "**${MASTER_BOQ_META.collectionLabel} Bill X: GHS [amount]**"
End summary: "**${MASTER_BOQ_META.carriedToSummary}: GHS [amount]**"

BILL ORDER (use these exact bill titles in order; skip only if scope clearly absent on drawings):
${getBillListForPrompt()}

DO NOT INCLUDE unless user requests: ${OPTIONAL_SCOPE.join('; ')}

RATE BUILD-UP STYLE:
- Separate material cost + labour cost mentally; show composite rate in BOQ with brief rate build-up note for major items
- Show wastage in quantity calculation notes (not silent)
- Prime cost (PC) items marked "PC Sum" in rate column
- Provisional sums as line items in Bill 24

REQUIRED OUTPUT SECTIONS (in this order):
### DRAWING & DOCUMENT TAKEOFF
### ASSUMPTIONS
### EXCLUSIONS & CLARIFICATIONS
### PROVISIONAL ITEMS
[Then each bill:]
### BILL [n] — [TITLE]
${BOQ_TABLE_HEADER}
|---------|----------|-------------|------|-----|------------|--------------|
[items…]
**Collection Bill [n]: GHS [amount]**
### BILL COLLECTION SUMMARY
| Bill | Description | Amount (GHS) |
### MATERIAL SCHEDULE (SUMMARY)
| Section | Material | Unit | Qty | Rate (GHS) | Amount (GHS) |
### LABOUR SCHEDULE (SUMMARY)
| Trade | Description | Unit | Qty | Rate (GHS) | Amount (GHS) |
### COMMERCIAL SUMMARY
| Item | Amount (GHS) |
### RISK REGISTER
`.trim()
}
