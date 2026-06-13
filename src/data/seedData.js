// src/data/seedData.js — Initial application data

export const INITIAL_PROJECTS = [
  {
    id: 'proj-1',
    name: 'Riverside Apartments Block C',
    type: 'Residential',
    status: 'active',
    createdAt: '2025-04-01',
    updatedAt: '2025-05-14',
    meta: {
      quoteNum: 'DLC-EST-2025-047',
      date: '2025-05-01',
      validDays: '30',
      clientName: 'Kwame Asante Properties',
      clientContact: '+233 0244 123456',
      clientEmail: 'kwame@asanteproperties.com',
      projectLocation: 'Tema Community 18, Greater Accra',
      projectTitle: '3-Bedroom Detached Bungalow',
      projectDescription: 'Construction of a 3-bedroom detached bungalow including strip foundation, 150mm hollow block superstructure, corrugated iron roof, floor tiling, internal plaster and paint.',
    },
    boqRows: [
      { id: 1, section: 'Substructure', desc: 'Excavation to formation level', unit: 'm³', qty: '45', rate: '12', amount: '540', clientSupplied: false },
      { id: 2, section: 'Substructure', desc: 'Blinding concrete 50mm (C15 mix — 32.5R)', unit: 'm²', qty: '120', rate: '8', amount: '960', clientSupplied: false },
      { id: 3, section: 'Substructure', desc: 'DPC 150mm wide (polythene strip)', unit: 'lm', qty: '85', rate: '3.50', amount: '297.50', clientSupplied: false },
      { id: 4, section: 'Superstructure', desc: 'Hollow block walling 150mm', unit: 'm²', qty: '320', rate: '95', amount: '30400', clientSupplied: false },
      { id: 5, section: 'Roofing', desc: 'Long span corrugated roof sheets', unit: 'sheets', qty: '95', rate: '145', amount: '13775', clientSupplied: false },
      { id: 6, section: 'Finishes', desc: 'Ceramic floor tiles 600×600mm', unit: 'm²', qty: '120', rate: '85', amount: '10200', clientSupplied: false },
      { id: 7, section: 'Preliminaries', desc: 'Site supervision & foreman', unit: 'ls', qty: '1', rate: '4500', amount: '4500', clientSupplied: false },
    ],
    materials: [],
    labor: [],
    prelims: [],
    risks: [],
    procurement: [],
    contractSum: 285750,
    documents: [],
  },
  {
    id: 'proj-2',
    name: 'Greenfield Industrial Warehouse',
    type: 'Industrial',
    status: 'draft',
    createdAt: '2025-05-10',
    updatedAt: '2025-05-14',
    meta: {
      quoteNum: 'DLC-EST-2025-048',
      date: '2025-05-10',
      validDays: '30',
      clientName: '',
      clientContact: '',
      clientEmail: '',
      projectLocation: 'Tema Free Zone',
      projectTitle: 'Industrial Warehouse',
      projectDescription: '',
    },
    boqRows: [],
    materials: [],
    labor: [],
    prelims: [],
    risks: [],
    procurement: [],
    contractSum: 0,
    documents: [],
  },
]

export const INITIAL_BOQ_ROWS = [
  { id: 1, section: 'Substructure', desc: 'Excavation to formation level', unit: 'm³', qty: '45', rate: '12', amount: '540', clientSupplied: false },
  { id: 2, section: 'Substructure', desc: 'Blinding concrete 50mm (C15 — 32.5R cement)', unit: 'm²', qty: '120', rate: '8', amount: '960', clientSupplied: false },
  { id: 3, section: 'Superstructure', desc: 'Hollow block walling 150mm', unit: 'm²', qty: '', rate: '', amount: '', clientSupplied: false },
]

export const INITIAL_PRICES = [
  { id: 1, material: 'Cement 42.5R (High Strength)', unit: 'bag (50kg)', price: '95', supplier: 'BuildMart' },
  { id: 2, material: 'Cement 32.5R (Standard)', unit: 'bag (50kg)', price: '78', supplier: 'BuildMart' },
  { id: 3, material: 'River Sand (Washed)', unit: 'm³', price: '220', supplier: 'QuarryMasters' },
  { id: 4, material: 'Granite Chippings 20mm', unit: 'm³', price: '280', supplier: 'QuarryMasters' },
  { id: 5, material: 'Quarry Dust', unit: 'm³', price: '160', supplier: 'QuarryMasters' },
  { id: 6, material: 'Hollow Blocks 150mm', unit: 'nr', price: '6.50', supplier: 'BuildMart' },
  { id: 7, material: 'Rebar Y12 (6m bar)', unit: 'length', price: '42', supplier: 'SteelCo' },
  { id: 8, material: 'Rebar Y16 (6m bar)', unit: 'length', price: '72', supplier: 'SteelCo' },
]

export const INITIAL_RISKS = [
  { id: 1, risk: 'Unforeseen ground conditions', likelihood: 'Medium', impact: 'High', rating: 'HIGH', mitigation: 'Geotech report; include provisional sum in tender' },
  { id: 2, risk: 'Material price escalation (cement, steel)', likelihood: 'High', impact: 'Medium', rating: 'HIGH', mitigation: 'Fix key prices early; include escalation clause in contract' },
  { id: 3, risk: 'Client-supplied material delay', likelihood: 'Medium', impact: 'High', rating: 'HIGH', mitigation: 'Programme float; LD clause for late supply' },
  { id: 4, risk: 'Drawing design changes mid-construction', likelihood: 'High', impact: 'Medium', rating: 'HIGH', mitigation: 'VO procedure in place; freeze design before mobilisation' },
  { id: 5, risk: 'Labour shortage / productivity', likelihood: 'Medium', impact: 'Medium', rating: 'MEDIUM', mitigation: 'Pre-qualify subcontractors; resource-load programme' },
]

export const INITIAL_PROCUREMENT = [
  { id: 1, material: 'Cement 42.5R', supplier: '', quantity: '', unit: 'bags', leadTime: '1-2 days', status: 'pending', price: '', longLead: false },
  { id: 2, material: 'Reinforcement Steel Y16', supplier: '', quantity: '', unit: 'tonnes', leadTime: '3-5 days', status: 'pending', price: '', longLead: false },
  { id: 3, material: 'Long Span Roof Sheets', supplier: '', quantity: '', unit: 'sheets', leadTime: '5-10 days', status: 'pending', price: '', longLead: true },
]

export const QUICK_PROMPTS = [
  'Estimate a 3-bedroom bungalow ground slab',
  'Full BOQ for 200m² office fit-out',
  'Blocks for a 10×8m room at 3m height?',
  'C25 concrete slab 12×8m at 150mm thick',
  'Bathroom waterproofing package 12m²',
  'Foundation strip 30m perimeter 0.9m deep',
]
