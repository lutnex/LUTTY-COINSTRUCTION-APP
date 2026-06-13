/**
 * Quantity extraction strategy — drawing intelligence for QS takeoff.
 */

export const DRAWING_TAKEOFF_PROMPT = `
DRAWING & DOCUMENT INTELLIGENCE (PRIMARY SOURCE — minimize user questions):

When drawings, PDFs, or images are attached, YOU are the quantity surveyor performing a takeoff:
1. Read every plan, elevation, section, detail, schedule, and specification note visible.
2. Infer and record:
   - Building footprint, floor areas, room schedule (name, L×W, area)
   - Wall lengths, heights, thicknesses (150mm block, 225mm, concrete, etc.)
   - Slab thicknesses, beam sizes, column grids if shown
   - Roof plan area, pitch, covering type, eaves, valleys, ridges
   - Door/window schedules (sizes, counts, types)
   - Ceiling types per room
   - Finish schedules (floor/wall finishes)
   - MEP routes where visible (wet areas, DB locations, AC units)
   - External aprons, steps, drain runs
3. Calculate quantities using standard QS methods:
   - Excavation: plan area × depth + working space allowance
   - Concrete: L×W×T; deduct openings >0.1m² where applicable
   - Blockwork: wall length × height − openings; add 10% wastage
   - Plaster: both sides where applicable; screed areas from room schedule
   - Tiles: net area + 12% wastage; skirting LM from perimeter
   - Paint: wall/ceiling areas from dimensions
   - Roofing: plan area × slope factor + 10% wastage
4. State key dimensions used in ### DRAWING & DOCUMENT TAKEOFF before BOQ tables.
5. If dimension is unclear, state ASSUMPTION with reasonable Ghana residential/commercial default.
6. Do NOT ask the user for dimensions already readable on drawings.
7. If no drawings attached, use brief sensible assumptions and list them under ### ASSUMPTIONS.

OCR / SCANNED DRAWINGS: Read dimensions from images even if PDF text layer is empty.
`.trim()

export const BOQ_GENERATION_USER_DEFAULT = `
Generate a FULL-SCOPE professional Bill of Quantities from the attached drawings/documents.
Follow the master bill structure exactly. Include all visible trades.
Produce complete priced BOQ suitable for tender, bank, and commercial review.
`.trim()

export function isDrawingLedRequest(text = '', attach = null) {
  const t = text.toLowerCase()
  const hasFiles = Boolean(attach && !attach.failed)
  const hasVision = (attach?.images?.length ?? 0) > 0
  if (hasVision || attach?.kind === 'pdf' || attach?.kind === 'image') return true
  return /drawing|plan|upload|attach|pdf|takeoff|from file/i.test(t)
}
