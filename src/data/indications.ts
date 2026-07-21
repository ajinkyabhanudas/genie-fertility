export interface Indication {
  id: string;
  name: string;
  priority: string;
  verdict: string;
  scores: {
    biomarker: string;
    sam: string;
    wtp: string;
    ltv: string;
    exit: string;
    rd: string;
  };
  details: {
    sam: string;
    wtp: string;
    ltv: string;
    biomarkers: string;
    acquirer: string;
    rd_cost: string;
    rd_breakdown?: { item: string; cost: string; rationale: string }[];
    timeline: string;
    risk: string;
  };
}

export const INDICATIONS: Indication[] = [
  {
    id: 'rif',
    name: 'Recurrent Implantation Failure',
    priority: '1st',
    verdict: 'Highest priority adjacency. Platform overlap is immediate - infection, microbiome, and inflammation markers already validated.',
    scores: {
      biomarker: 'High',
      sam: 'Medium ($32M-$80M)',
      wtp: 'Very High',
      ltv: 'Medium-High',
      exit: 'High',
      rd: 'Low investment'
    },
    details: {
      sam: '$32M-$80M across core markets at $500/test',
      wtp: 'Very High. Post-multiple-failed-cycle patients. ERA all-in cost $2,000-$3,500 vs Genie $500.',
      ltv: '$650-$900 over 5 years including cross-sell to core IVF panel',
      biomarkers: 'Chronic endometritis pathogens (Mycoplasma, Ureaplasma), Lactobacillus disruption, IL-2, IL-6, IL-17A, NK cell markers. Infection/microbiome component confirmed. Receptivity-specific markers (RAB32, TRIB2, FAM155B) require validation study.',
      acquirer: 'CooperSurgical (+1.0-1.5x on base multiple), Vitrolife/Igenomix (+0.5-1.0x)',
      rd_cost: '£80,000-£120,000',
      rd_breakdown: [
        { item: 'Lab Consumables', cost: '£35k', rationale: 'Reagents for 150 patient cohort cross-validation.' },
        { item: 'Clinical Coordination', cost: '£40k', rationale: 'Data collection across 3 clinic sites.' },
        { item: 'Biostats & AI Model', cost: '£25k', rationale: 'Transcriptome signal-to-noise refinement.' }
      ],
      timeline: '12-18 months to publication',
      risk: 'RIF definition is not standardised across centres. Cohort design must specify the threshold (2 vs 3 failed transfers, euploid embryos or not).'
    }
  },
  {
    id: 'endo',
    name: 'Endometriosis',
    priority: '2nd',
    verdict: 'Second priority. Largest SAM. Highest acquisition premium via pharma channel. Competitive window is narrowing.',
    scores: {
      biomarker: 'High',
      sam: 'High ($195M-$316M)',
      wtp: 'High',
      ltv: 'High',
      exit: 'Very High',
      rd: 'Medium investment'
    },
    details: {
      sam: '$195M-$316M across core markets at $600/test',
      wtp: 'High. Average 4-11 years to diagnosis. Ziwig competitor priced at £995.',
      ltv: '$780-$900 over 5 years plus endometriosis-to-IVF pipeline (30-50% of endo patients experience infertility)',
      biomarkers: 'OPN, IL-10, IL-6 (ddELISA, April 2025 PMC11961069). Aromatase, SF-1, HSD17B2 gene expression (2024 EJOGRB publication). DNA methylation of MenSCs (79% sensitivity, 83% specificity, biorxiv July 2025). French INSERM MultiMENDo trial (NCT06245512) recruiting since July 2024. Blood test benchmark: AUC 0.944, sensitivity 0.80, specificity 0.975 (March 2026 ScienceDirect).',
      acquirer: 'AbbVie (treatment pharma, companion diagnostic angle, 6-8x revenue). CooperSurgical (+1.5-2.0x).',
      rd_cost: '£150,000-£200,000',
      rd_breakdown: [
        { item: 'Patient Recruitment', cost: '£80k', rationale: 'Targeting 300 biopsy-confirmed cases.' },
        { item: 'MultiMENDo Alignment', cost: '£50k', rationale: 'Harmonising protocols with INSERM standards.' },
        { item: 'Regulatory Pathway', cost: '£40k', rationale: 'IVDR Class C documentation prep.' }
      ],
      timeline: '18-24 months to publication',
      risk: 'ESHRE guidelines currently advise against biomarker-based diagnosis. Must generate evidence at ESHRE evidentiary threshold, not just statistical significance.'
    }
  },
  {
    id: 'adeno',
    name: 'Adenomyosis',
    priority: '3rd (conditional)',
    verdict: 'Third, conditional. No home-test competitor exists. TAM is large but prevalence data is unreliable and the differentiation-from-endometriosis problem is unresolved.',
    scores: {
      biomarker: 'Medium',
      sam: 'Medium ($140M-$280M)',
      wtp: 'Medium',
      ltv: 'Low-Medium',
      exit: 'Medium',
      rd: 'High investment'
    },
    details: {
      sam: '$140M-$280M (conservative 10% prevalence assumption, high uncertainty)',
      wtp: 'Medium. No price anchor exists. Low consumer awareness of the condition.',
      ltv: 'Low-Medium',
      biomarkers: 'VEGF, IL-6, TGF, nerve fibre (Dec 2025 literature review). miR-101-3p, miR-143-3p are serum-derived, not menstrual blood validated. Differentiation from endometriosis in a single menstrual blood sample has not been solved in published literature.',
      acquirer: 'Imaging companies (GE HealthCare, Philips, Siemens) seeking complementary diagnostic to MRI.',
      rd_cost: '£20,000-£40,000 for literature review',
      timeline: 'Year 2 action: Commission review',
      risk: 'Hysterectomy is the only curative treatment. Post-hysterectomy patients cannot use the product.'
    }
  },
  {
    id: 'pcos',
    name: 'PCOS',
    priority: '4th (cross-sell only)',
    verdict: 'Fourth, cross-sell only. Anovulation reduces sample reliability for highest-need patients. Should not be funded as primary adjacency.',
    scores: {
      biomarker: 'Low-Medium',
      sam: 'Medium ($195M-$390M conditional)',
      wtp: 'Low-Medium',
      ltv: 'Low',
      exit: 'Low-Medium',
      rd: 'Medium investment'
    },
    details: {
      sam: '$195M-$390M theoretical, highly conditional on differentiation from blood-based alternatives',
      wtp: 'Low-Medium. LetsGetChecked PCOS panel available at $149. Genie at $500 requires strong differentiation case.',
      ltv: 'Low. Strategic use as customer acquisition tool in D2C (UK).',
      biomarkers: 'AMH validation in menstrual blood has not reached the clinical standard of serum AMH. Anovulation makes collection unreliable.',
      acquirer: 'Diagnostic lab companies (Quest, LabCorp, Dr. Lal PathLabs). Lower multiple than fertility/pharma routes.',
      rd_cost: 'N/A (strategic cross-sell)',
      timeline: 'Phase 3 rollout',
      risk: 'Rotterdam criteria update (2023) allows diagnosis on irregular cycles plus hyperandrogenism alone. Diagnostic pathway getting simpler.'
    }
  }
];
