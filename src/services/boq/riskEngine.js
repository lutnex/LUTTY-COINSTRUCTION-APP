/**
 * Automatic commercial risk register generation for BOQ / estimate outputs.
 */

export const RISK_CATEGORIES = {
  HIGH: [
    'Structural assumptions not verified by engineer',
    'Unforeseen ground conditions / rock excavation',
    'Incomplete or draft architectural drawings',
    'Specification assumptions for unseen MEP routes',
    'Client-supplied material delivery delays',
    'Inflation / material price escalation during programme',
  ],
  MEDIUM: [
    'Transport cost fluctuation (fuel, haulage to site)',
    'Material availability / long-lead items',
    'Labour productivity on constrained site',
    'Variation exposure from design development',
    'Weather disruption to external works',
    'Testing & commissioning scope boundaries',
  ],
  LOW: [
    'Minor finishing colour/finish changes',
    'Standard site waste within wastage allowance',
    'Routine snagging at handover',
    'Documentation / as-built drawing provision',
  ],
}

export const RISK_REGISTER_FORMAT = `
### RISK REGISTER
| Rating | Risk | Likelihood | Impact | Mitigation |
|--------|------|------------|--------|------------|
[Minimum 3 HIGH, 3 MEDIUM, 3 LOW rows — project-specific, not generic only]

Also include under ### RISKS AND EXCLUSIONS:
HIGH RISK: [summary]
MEDIUM RISK: [summary]
LOW RISK: [summary]
`.trim()

export function buildRiskInstructions(projectType = 'general') {
  return `
RISK MANAGEMENT ENGINE (MANDATORY for every BOQ/estimate):
Auto-generate project-specific risks based on scope complexity (${projectType}).
Cover at minimum: ${RISK_CATEGORIES.HIGH.slice(0, 4).join('; ')}.
${RISK_REGISTER_FORMAT}
`.trim()
}
