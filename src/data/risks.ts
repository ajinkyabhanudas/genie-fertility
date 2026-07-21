export const risks = [
  { id: 1, title: "ERA replacement narrative rejection", prob: 20, impact: "HIGH", severity: "coral", description: "Market resists move away from established ERA benchmarks." },
  { id: 2, title: "US LDT regulatory tightening", prob: 30, impact: "MEDIUM", severity: "coral", description: "FDA changes oversight on Laboratory Developed Tests." },
  { id: 3, title: "India partner underperformance", prob: 25, impact: "MEDIUM", severity: "coral", description: "Local distributor fails to hit Year 2 penetration targets." },
  { id: 4, title: "PCOS validation shows no signal", prob: 20, impact: "MEDIUM", severity: "gold", description: "Clinical trials fail to show significant biomarker correlation." },
  { id: 5, title: "Endometriosis competitor achieves first-mover", prob: 35, impact: "MEDIUM", severity: "gold", description: "Rival firm launches validated panel 6 months ahead of Genie." },
  { id: 6, title: "Series B fundraising difficult", prob: 25, impact: "HIGH", severity: "gold", description: "Macroeconomic climate reduces VC appetite for diagnostics." },
  { id: 7, title: "Japan regulatory attempt", prob: 10, impact: "LOW", severity: "teal", description: "PMDA requirements prove more complex than anticipated." }
];

export const decisions = [
  { id: 1, trigger: "US Revenue < £0.5M in Y2", response: "Pivot to B2B clinic network only", owner: "CEO / Head of US", timeline: "Q4 2026" },
  { id: 2, trigger: "PCOS validation success", response: "Accelerate India marketing spend by 50%", owner: "CMO", timeline: "Q2 2026" },
  { id: 3, trigger: "Series B delayed > 6 months", response: "Implement 'Lean' cost scenario immediately", owner: "CFO", timeline: "Q1 2027" },
  { id: 4, trigger: "Spain partner signed", response: "Hire 2x local clinical liaisons", owner: "COO", timeline: "Triggered by signature" },
  { id: 5, trigger: "Competitor launches Endo panel", response: "Release 'Genie Early Access' whitepaper", owner: "CSO", timeline: "Immediate" },
  { id: 6, trigger: "India volume > 50k tests/yr", response: "Move from Distributor to JV model", owner: "CEO", timeline: "Y3-Y4" },
  { id: 7, trigger: "UK NHS pilot approval", response: "Dedicated public health team hire", owner: "COO", timeline: "Q3 2026" }
];
