// ── Design tokens ──────────────────────────────────────────────────────────────
export const C = {
  ink:       '#070A0D',
  carbon:    '#0D1117',
  slate:     '#141B24',
  panel:     '#19212C',
  panel2:    '#1E2838',
  border:    '#253040',
  muted:     '#364255',
  hover:     '#1F2D40',
  amber:     '#F59E0B',
  amberLo:   '#7A4A0A',
  amberGlow: 'rgba(245,158,11,0.10)',
  gold:      '#FCD34D',
  sky:       '#38BDF8',
  green:     '#34D399',
  red:       '#F87171',
  purple:    '#A78BFA',
  teal:      '#2DD4BF',
  orange:    '#FB923C',
  text:      '#DDE5F0',
  textDim:   '#6E84A3',
  textFaint: '#334155',
  navy:      '#0A2A43',
  navyRed:   '#B00020',
}

// ── Company ───────────────────────────────────────────────────────────────────
export const COMPANY = {
  name:        'DE-LUTEROITS CONSTRUCTION',
  tagline:     'Building Excellence Across Ghana',
  registration:'GS-0423-5468',
  address:     'Mile 11 Weija, Accra — Ghana',
  phone1:      '(+233) 0508784758',
  phone2:      '0244514126',
  email:       'info@deluteroitsconstruction.com',
  website:     'www.deluteroitsconstruction.com',
  momo:        '0597414577',
  momoName:    'De-Luteroits Construction',
  authorizedBy:'Eric Amoako Luteroit',
  position:    'Manager',
  initials:    'DLC',
}

// ── BOQ sections (aligned with master bill template) ─────────────────────────
export const BOQ_SECTIONS = [
  'Preliminaries',
  'Earthworks',
  'Substructure',
  'Concrete',
  'Formwork',
  'Reinforcement',
  'Masonry',
  'Roofing',
  'Ceilings',
  'Doors & Windows',
  'Glazing',
  'Floor Finishes',
  'Wall Finishes',
  'Painting',
  'Waterproofing',
  'Plumbing 1st Fix',
  'Plumbing 2nd Fix',
  'Electrical 1st Fix',
  'Electrical 2nd Fix',
  'HVAC',
  'External Works',
  'Drainage',
  'Testing & Commissioning',
  'Provisional Sums',
  'OH&P & Contingency',
  'General',
]

// ── Document types ────────────────────────────────────────────────────────────
export const DOC_TYPES = {
  estimate:      'CONSTRUCTION ESTIMATE',
  quotation:     'PROJECT QUOTATION',
  boq:           'BILL OF QUANTITIES',
  procurement:   'PROCUREMENT SCHEDULE',
  risk_report:   'RISK ASSESSMENT REPORT',
  variation:     'VARIATION ORDER',
  invoice:       'PROFORMA INVOICE',
  payment_cert:  'PAYMENT CERTIFICATE',
}

// ── Navigation items ──────────────────────────────────────────────────────────
export const NAV_ITEMS = [
  { id: 'chat',        icon: '🤖', label: 'Estimator Agent'     },
  { id: 'projects',    icon: '📁', label: 'Projects'            },
  { id: 'boq',         icon: '📋', label: 'BOQ Builder'         },
  { id: 'docgen',      icon: '🖨️', label: 'Document Generator'  },
  { id: 'calcs',       icon: '🔢', label: 'Calculators'         },
  { id: 'procurement', icon: '🛒', label: 'Procurement'         },
  { id: 'risks',       icon: '⚠️', label: 'Risk Register'       },
  { id: 'prices',      icon: '💰', label: 'Price Profiles'      },
  { id: 'tools',       icon: '🔧', label: 'Quick Tools'         },
]

// ── Quick prompts ─────────────────────────────────────────────────────────────
export const QUICK_PROMPTS = [
  'Estimate a 3-bedroom bungalow slab',
  'Full BOQ for 200m² office fit-out',
  'Blocks for a 10x8m room at 3m height?',
  'C25 concrete slab 12×8×0.15m',
  'Bathroom waterproofing 12m² package',
  'Foundation strip 30m perimeter 0.9m deep',
]

// ── AI retry config (endpoint/model from Vite env via src/config/env.js) ─────
import { ENV } from '../config/env.js'

export const AI_CONFIG = {
  model:       ENV.model,
  endpoint:    ENV.endpoint,
  temperature: ENV.temperature,
  timeoutMs:   ENV.timeoutMs,
  maxRetries:  ENV.maxRetries,
  retryDelays: [1200, 2800, 5500],
  retryStatus: [429, 500, 502, 503, 529],
}

// ── AI progress stage labels ──────────────────────────────────────────────────
export const AI_STAGES = {
  boq:         ['Parsing project scope…','Measuring quantities…','Applying wastage rules…','Pricing at Accra market rates…','Finalising BOQ…'],
  drawing:     ['Processing file…','Analysing floor plan geometry…','Extracting room data…','Building quantity takeoff…','Compiling estimate…'],
  estimate:    ['Reading project brief…','Computing material quantities…','Pricing labour gangs…','Adding prelims & margin…','Writing commercial summary…'],
  procurement: ['Reviewing procurement list…','Checking lead times…','Sequencing deliveries…','Flagging long-lead items…','Finalising advice…'],
  risk:        ['Reading risk register…','Scoring likelihood & impact…','Identifying gaps…','Drafting mitigations…','Finalising report…'],
  chat:        ['Analysing query…','Cross-referencing construction data…','Preparing response…'],
  pdf:         ['Preparing document layout…','Rendering tables…','Adding De-Luteroits branding…','Finalising…'],
  docfill:     ['Reading BOQ context…','Generating scope…','Building material schedule…','Calculating labour…','Finalising document…'],
}

// ── Mix ratios ────────────────────────────────────────────────────────────────
export const MIX_RATIOS = {
  '1:1.5:3': { c: 8.6, s: 0.45, a: 0.9,  grade: 'C25–C30', cement: '42.5R' },
  '1:2:4':   { c: 6.0, s: 0.44, a: 0.88, grade: 'C20',     cement: '42.5R' },
  '1:3:6':   { c: 4.0, s: 0.43, a: 0.86, grade: 'C15',     cement: '32.5R' },
  '1:4:8':   { c: 3.0, s: 0.42, a: 0.84, grade: 'Blinding', cement: '32.5R' },
}

// ── Default project data ──────────────────────────────────────────────────────
export const DEFAULT_PROJECTS = [
  {
    id: 'p1', name: 'Riverside Apartments Block C',
    type: 'Residential', status: 'active',
    createdAt: '2025-04-01', updatedAt: '2025-05-14',
    meta: {
      quoteNum: 'DLC-EST-2025-047', date: '2025-05-01', validDays: '30',
      clientName: 'Kwame Asante Properties', clientContact: '+233 0244 123456',
      clientEmail: 'kwame@asanteproperties.com',
      projectLocation: 'Tema Community 18, Greater Accra',
      projectTitle: '3-Bedroom Detached Bungalow',
      projectDescription: 'Construction of a 3-bedroom detached bungalow including strip foundation, 150mm hollow block superstructure, corrugated iron roof, floor tiling, internal plaster and paint.',
    },
    boqRows: [
      { id: 1, section: 'Substructure',   desc: 'Excavation to formation level',    unit: 'm³',    qty: '45',  rate: '12',  amount: '540',   clientSupplied: false },
      { id: 2, section: 'Substructure',   desc: 'Blinding concrete 50mm (C15)',     unit: 'm²',    qty: '120', rate: '8',   amount: '960',   clientSupplied: false },
      { id: 3, section: 'Superstructure', desc: 'Hollow block walling 150mm',       unit: 'm²',    qty: '320', rate: '95',  amount: '30400', clientSupplied: false },
      { id: 4, section: 'Roofing',        desc: 'Long span corrugated roof sheets', unit: 'sheets',qty: '95',  rate: '145', amount: '13775', clientSupplied: false },
      { id: 5, section: 'Finishes',       desc: 'Ceramic floor tiles 600×600mm',   unit: 'm²',    qty: '120', rate: '85',  amount: '10200', clientSupplied: false },
    ],
    materials: [], labor: [], prelims: [], risks: [], procurement: [],
    contractSum: 285750, documents: [],
  },
  {
    id: 'p2', name: 'Greenfield Industrial Warehouse',
    type: 'Industrial', status: 'draft',
    createdAt: '2025-05-10', updatedAt: '2025-05-14',
    meta: {
      quoteNum: 'DLC-EST-2025-048', date: '2025-05-10', validDays: '30',
      clientName: '', clientContact: '', clientEmail: '',
      projectLocation: 'Tema Free Zone', projectTitle: 'Industrial Warehouse',
      projectDescription: '',
    },
    boqRows: [], materials: [], labor: [], prelims: [], risks: [],
    procurement: [], contractSum: 0, documents: [],
  },
]

// ── Default price profiles ────────────────────────────────────────────────────
export const DEFAULT_PRICES = [
  { id: 1, material: 'Cement 42.5R',        unit: 'bag (50kg)', price: '95',   supplier: 'BuildMart'    },
  { id: 2, material: 'Cement 32.5R',        unit: 'bag (50kg)', price: '78',   supplier: 'BuildMart'    },
  { id: 3, material: 'River Sand',          unit: 'm³',         price: '220',  supplier: 'QuarryMasters'},
  { id: 4, material: 'Granite Chippings',   unit: 'm³',         price: '280',  supplier: 'QuarryMasters'},
  { id: 5, material: 'Hollow Blocks 150mm', unit: 'nr',         price: '6.50', supplier: 'BuildMart'    },
  { id: 6, material: 'Rebar Y12',           unit: '6m bar',     price: '42',   supplier: 'SteelCo'      },
  { id: 7, material: 'Rebar Y16',           unit: '6m bar',     price: '72',   supplier: 'SteelCo'      },
]

// ── Default risks ─────────────────────────────────────────────────────────────
export const DEFAULT_RISKS = [
  { id: 1, risk: 'Unforeseen ground conditions',   likelihood: 'Medium', impact: 'High',   rating: 'HIGH',   mitigation: 'Geotech report; include provisional sum' },
  { id: 2, risk: 'Material price escalation',      likelihood: 'High',   impact: 'Medium', rating: 'HIGH',   mitigation: 'Fix key prices; include escalation clause' },
  { id: 3, risk: 'Client-supplied material delay', likelihood: 'Medium', impact: 'High',   rating: 'HIGH',   mitigation: 'Programme float; LD clause for late supply' },
  { id: 4, risk: 'Drawing design changes',         likelihood: 'High',   impact: 'Medium', rating: 'HIGH',   mitigation: 'VO procedure; freeze design before mobilisation' },
  { id: 5, risk: 'Labour shortage / productivity', likelihood: 'Medium', impact: 'Medium', rating: 'MEDIUM', mitigation: 'Pre-qualify subcontractors; resource-level programme' },
]

// ── Default procurement ───────────────────────────────────────────────────────
export const DEFAULT_PROC = [
  { id: 1, material: 'Cement 42.5R',           supplier: '', quantity: '', unit: 'bags',    leadTime: '1–2 days',  status: 'pending', price: '', longLead: false },
  { id: 2, material: 'Reinforcement Steel Y16', supplier: '', quantity: '', unit: 'tonnes',  leadTime: '3–5 days',  status: 'pending', price: '', longLead: false },
  { id: 3, material: 'Long Span Roof Sheets',   supplier: '', quantity: '', unit: 'sheets',  leadTime: '5–10 days', status: 'pending', price: '', longLead: true  },
]
