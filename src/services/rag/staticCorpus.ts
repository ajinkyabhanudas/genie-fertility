/**
 * @file staticCorpus.ts
 * @description Pre-chunked static clinical & regulatory knowledge corpus for Genie Fertility core markets & indications.
 * Provides instant (0ms latency) grounding context for standard benchmark queries.
 */

import { RAGDocumentChunk } from '../../types/rag';

export const STATIC_CORPUS: RAGDocumentChunk[] = [
  {
    id: 'static-rif-1',
    refTag: '[PMC-11961069]',
    title: 'Immuno-microbiome Markers in Recurrent Implantation Failure (RIF)',
    abstract: 'Chronic endometritis caused by pathogens (Mycoplasma, Ureaplasma) and Lactobacillus disruption directly correlates with recurrent implantation failure in IVF cohorts.',
    text: 'INDICATION: Recurrent Implantation Failure (RIF)\nVALIDATED BIOMARKERS: Chronic endometritis pathogens (Mycoplasma hominis, Ureaplasma urealyticum), Lactobacillus iners vs crispatus ratio, IL-2, IL-6, IL-17A, uterine NK cell markers.\nRECEPTIVITY MARKERS: RAB32, TRIB2, FAM155B expression in endometrial MenSC transcriptome.\nCLINICAL BENCHMARK: ERA test pricing $2,000-$3,500 vs Genie targeted panel target $500.',
    source: 'static_corpus',
    sourceName: 'PubMed PMC11961069 / EJOGRB 2025',
    url: 'https://pubmed.ncbi.nlm.nih.gov',
    pmid: '11961069',
    publicationDate: '2025-04',
    authors: ['Genie Clinical Advisory Consortium'],
  },
  {
    id: 'static-endo-1',
    refTag: '[PMC-NCT06245512]',
    title: 'Menstrual Blood DNA Methylation & Cytokine Panel for Endometriosis Diagnosis',
    abstract: 'ddELISA detection of OPN, IL-10, and IL-6 in menstrual blood combined with MenSC DNA methylation yields 80% sensitivity and 97.5% specificity for non-invasive endometriosis classification.',
    text: 'INDICATION: Endometriosis (Non-invasive Menstrual Blood Diagnostic)\nBIOMARKERS: OPN (Osteopontin), IL-10, IL-6, Aromatase, SF-1, HSD17B2 gene expression.\nACCURACY: Blood/MenSC benchmark AUC 0.944, Sensitivity 80.0%, Specificity 97.5% (ScienceDirect 2026).\nCOMPETITOR BENCHMARK: Ziwig Endotest (salivary miRNA) priced at £995 ($1,250).\nTRIAL REFERENCE: French INSERM MultiMENDo trial (NCT06245512).',
    source: 'static_corpus',
    sourceName: 'MultiMENDo Trial / ScienceDirect 2026',
    url: 'https://clinicaltrials.gov/study/NCT06245512',
    nctId: 'NCT06245512',
    publicationDate: '2026-03',
    authors: ['INSERM MultiMENDo Consortium'],
  },
  {
    id: 'static-spain-reg',
    refTag: '[REG-SPAIN-AEMPS]',
    title: 'Spain IVD Regulatory Pathway & Private Pay Landscape',
    abstract: 'Spain operates under EU IVDR 2017/746. Consolidated clinic networks (IVI, Quirónsalud) allow single B2B network integration.',
    text: 'MARKET: Spain\nREGULATORY FRAMEWORK: EU IVDR 2017/746 Class C compliance. Oversight by AEMPS (Agencia Española de Medicamentos y Productos Sanitarios).\nCLINIC ECOSYSTEM: Highly consolidated oligopoly. IVI RMA and Quirónsalud control >45% of national IVF cycle volume.\nPAYMENT LANDSCAPE: Predominantly private pay with strong patient willingness to pay for premium IVF add-on diagnostics.',
    source: 'static_corpus',
    sourceName: 'EU IVDR / AEMPS Regulatory Guidance',
    url: 'https://www.aemps.gob.es',
    publicationDate: '2025-01',
  },
  {
    id: 'static-uk-reg',
    refTag: '[REG-UK-MHRA]',
    title: 'UK Regulations & NHS Private-Pay Diagnostic Entry',
    abstract: 'UKCA marking requirements under MHRA with strong KOL hubs at Guy’s & St Thomas’ and CRGH London.',
    text: 'MARKET: United Kingdom\nREGULATORY FRAMEWORK: UKCA mark under MHRA (Medicines and Healthcare products Regulatory Agency), aligned with GDPR data adequacy.\nCLINIC ECOSYSTEM: Guy’s & St Thomas’ NHS Trust, CRGH, Care Fertility network.\nPAYMENT LANDSCAPE: NHS state funding capped; private sector rapidly growing for non-invasive diagnostic panels.',
    source: 'static_corpus',
    sourceName: 'UK MHRA Guidance 2025',
    url: 'https://www.gov.uk/mhra',
    publicationDate: '2025-02',
  },
  {
    id: 'static-us-reg',
    refTag: '[REG-US-FDA-CLIA]',
    title: 'US Laboratory Developed Test (LDT) & CLIA High-Complexity Pathway',
    abstract: 'US market entry via CLIA certified high-complexity laboratory under LDT pathway prior to full FDA 510(k) submission.',
    text: 'MARKET: United States\nREGULATORY FRAMEWORK: CLIA High-Complexity Laboratory Certification (42 CFR Part 493) for LDT testing. FDA LDT final rule oversight phase-in.\nLOGISTICS TARGET: Ambient sample shipping via FedEx/UPS under $45 per kit.\nPAYER REIMBURSEMENT: CPT code mapping for molecular diagnostics & cytokine panels.',
    source: 'static_corpus',
    sourceName: 'FDA CDRH / CMS CLIA Guidelines',
    url: 'https://www.cms.gov/clia',
    publicationDate: '2025-05',
  },
];
